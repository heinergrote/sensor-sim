import {createMemo, createSignal} from 'solid-js'
import {api, serverUrl} from "./api";
import {LoginResponse, Profile} from "@sensor-sim/shared";
import ky, {isHTTPError} from "ky";
import {query} from "@solidjs/router";

// Access token (15 min JWT), its expiry (epoch ms) and the opaque refresh token (rotated on every refresh,
// 7 days sliding on the server). All three in localStorage, shared by every tab of this origin.
const ACCESS_KEY = 'jwt_token'
const EXPIRES_KEY = 'jwt_expires_at'
const REFRESH_KEY = 'refresh_token'

/** refresh this long before the access token expires */
const REFRESH_MARGIN_MS = 60_000
/** cross-tab lock: only one tab may present the refresh token at a time (a reused one revokes the session) */
const REFRESH_LOCK = 'sensor-sim-auth-refresh'

/** The current access token, as is — may be expired. Use `getValidToken()` when about to send it. */
export const jwtToken = () => localStorage.getItem(ACCESS_KEY)
const storedRefreshToken = () => localStorage.getItem(REFRESH_KEY)
const accessExpiresAt = () => Number(localStorage.getItem(EXPIRES_KEY)) || 0
const accessIsFresh = () => jwtToken() !== null && accessExpiresAt() - Date.now() > REFRESH_MARGIN_MS

// Changes only on login/logout (also of other tabs), never on token rotation: `user` and everything keyed on it
// (e.g. the status socket) must not re-run every 15 minutes. A new object per login, so re-login re-triggers.
const [session, setSessionSignal] = createSignal<object | null>(null, {name: "auth.session"})
// plain mirror for non-reactive code (storage listener), so it doesn't read the signal outside a tracking scope
let currentSession: object | null = null
const setSession = (value: object | null) => {
  currentSession = value
  setSessionSignal(value)
}
if (storedRefreshToken()) setSession({})

/**
 * Reactive login state: a new object per login, `null` when logged out. Track it in anything that caches
 * per-user data (e.g. the configs store), so the next user in this browser never sees the previous one's.
 */
export const authSession = session

/** drop everything held for the logged-out user that isn't keyed on `authSession` */
function endSession() {
  clearTimeout(refreshTimer)
  setSession(null)
  // router query cache (users, user) — would otherwise be served to the next login for up to 5 s / kept 3 min
  query.clear()
}

function storeTokens(res: LoginResponse) {
  localStorage.setItem(ACCESS_KEY, res.accessToken)
  localStorage.setItem(EXPIRES_KEY, String(res.accessExpiresAt))
  localStorage.setItem(REFRESH_KEY, res.refreshToken)
  scheduleRefresh()
}

function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(EXPIRES_KEY)
  localStorage.removeItem(REFRESH_KEY)
  clearTimeout(refreshTimer)
}

export function login(res: LoginResponse) {
  storeTokens(res)
  setSession({})
}

export function logout() {
  const refreshToken = storedRefreshToken()
  clearTokens()
  endSession()
  if (refreshToken) {
    // revoke the server-side session; nothing to do if that fails
    ky.post(`${serverUrl}/api/login/logout`, {json: {refreshToken}}).catch(() => {
    })
  }
}

// ---------------------------------------------------------------------------------------------------------
// refresh

let inflight: Promise<string | null> | undefined

/**
 * New access token via the refresh token. Single-flight per tab, serialized across tabs.
 * `staleToken` = the token the caller considers unusable; if another tab already replaced it, that one is used
 * without a request. Resolves `null` when logged out — a rejected refresh token (401) logs out, a network error
 * keeps the session for the next attempt.
 */
export function refreshTokens(staleToken: string | null = jwtToken()): Promise<string | null> {
  inflight ??= withRefreshLock(() => doRefresh(staleToken)).finally(() => inflight = undefined)
  return inflight
}

function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request(REFRESH_LOCK, fn) : fn()
}

async function doRefresh(staleToken: string | null): Promise<string | null> {
  // read under the lock: another tab may have rotated meanwhile
  const current = jwtToken()
  if (current && current !== staleToken && accessIsFresh()) return current

  const refreshToken = storedRefreshToken()
  if (!refreshToken) return null

  try {
    const res = await ky.post(`${serverUrl}/api/login/refresh`, {json: {refreshToken}}).json<LoginResponse>()
    storeTokens(res)
    return res.accessToken
  } catch (e) {
    if (isHTTPError(e) && e.response.status === 401 && storedRefreshToken() === refreshToken) {
      logout()
    }
    return null
  }
}

/** An access token valid for at least another minute (refreshing if needed), or `null` when logged out. */
export async function getValidToken(): Promise<string | null> {
  if (!storedRefreshToken()) return null
  if (accessIsFresh()) return jwtToken()
  const refreshed = await refreshTokens()
  if (refreshed) return refreshed
  // refresh failed on the network: the old token may still have a few seconds left
  return storedRefreshToken() && accessExpiresAt() > Date.now() ? jwtToken() : null
}

/** Still logged in (has a refresh token) — e.g. to tell "server unreachable" from "logged out". */
export const isLoggedIn = () => storedRefreshToken() !== null

// Keep the access token fresh while logged in, even in an idle tab: MapLibre's `transformRequest` is
// synchronous and can only read whatever token is stored.
let refreshTimer: ReturnType<typeof setTimeout> | undefined

function scheduleRefresh() {
  clearTimeout(refreshTimer)
  if (!storedRefreshToken()) return
  const delay = Math.max(0, accessExpiresAt() - REFRESH_MARGIN_MS - Date.now())
  refreshTimer = setTimeout(async () => {
    // getValidToken refreshes only if no other tab did; a failed (network) attempt is retried in a while
    await getValidToken()
    if (accessIsFresh()) scheduleRefresh()
    else if (storedRefreshToken()) refreshTimer = setTimeout(scheduleRefresh, 30_000)
  }, delay)
}

scheduleRefresh()

// follow login/logout/rotation of other tabs (the event fires only in the *other* tabs)
window.addEventListener('storage', (e) => {
  if (e.key !== null && e.key !== REFRESH_KEY) return
  const loggedIn = storedRefreshToken() !== null
  if (!loggedIn && currentSession) {
    endSession()
  } else if (loggedIn && !currentSession) {
    setSession({})
  }
  if (loggedIn) scheduleRefresh()
})

// ---------------------------------------------------------------------------------------------------------

export function useAuth() {

  const user = createMemo(async () => {
    if (!session()) return null

    try {
      return await api.get("/me").json<Profile>()
    } catch (e) {
      // a failed refresh already logged out; also drop the session on a definitive auth failure
      if (isHTTPError(e) && (e.response.status === 401 || e.response.status === 403)) logout()
      return null
    }
  })

  return {login, logout, user}
}
