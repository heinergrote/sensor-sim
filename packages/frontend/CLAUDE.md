# packages/frontend — Agent Guide

SolidJS 2.x, **not React**: components run once (no re-render), reactivity is fine-grained signals, effects/memos
have Solid-specific semantics. Don't port React patterns.

## Commands (run here, or `pnpm --filter @sensor-sim/frontend <script>` from root)

```bash
pnpm dev                       # vite on :3000 (expects server on :4000)
pnpm build                     # vite build → dist/client, then typecheck
pnpm serve                     # preview the build
pnpm typecheck                 # tsc --noEmit
pnpm test                      # vitest (jsdom); single file: pnpm test src/foo.test.tsx — no test files yet
pnpm lint                      # oxlint src
```

## Architecture

- `src/App.tsx` / `src/Document.tsx` — shell and HTML document. The **only `Loading` boundary** wraps `Nav` + `main`
  in `App.tsx` (`Errored` is commented out). No `index.html`: `@solidjs/vite-plugin` turnkey mode generates entries.
- `src/routes.ts` — the explicit route tree (`defineRoutes`): `/`, `/sims/:id?`, `/users`, `/users/:id`, `*404`.
  Every page is a `lazy(() => import(...))` chunk under `src/pages/`.
- `src/pages/<area>/<area>.route.ts` — `defineRoute({path, matchFilters: {id: int}, preload?})` **without**
  `component`; `routes.ts` adds it as `defineRoute({...simsRoute, component: Sims})`. The page reads `props.params`
  via `RouteProps<typeof simsRoute.path>` with an `import type`; params arrive as strings → `Number(...)`.
  **A `*.route.ts` must never import its page** (pulls it into the main chunk). Typing a page from `Router.paths.*`
  causes TS2502 (circular).
- `src/router.ts` — `createRouter({routes, preloadLinks: intentPreload()})`; typed `paths` (`paths()`,
  `paths.sims(id?)`, `paths.users(id)`) — use them for links.
- `src/auth.ts` — tokens + expiry/refresh times in localStorage (`jwt_token`, `jwt_expires_at`, `jwt_refresh_at`,
  `refresh_token`), on the **local clock** from the server's relative `accessExpiresIn`; refresh due
  `min(60 s, lifetime / 2)` before expiry (a fixed margin longer than the lifetime looped). The `session` signal
  changes **only on login/logout** (also other tabs via `storage`) — rotation is deliberately not reactive.
  `refreshTokens(stale)` is single-flight per tab and runs under `navigator.locks` across tabs, re-reading storage
  (two tabs presenting one refresh token trip the server's reuse detection). Refresh 401 → logout; network error
  doesn't. A timer refreshes ahead of expiry. `useAuth()` → `{login, logout, user}` (`user` = async memo over
  `GET /api/me`). Logout also clears the router `query` cache.
- `src/api.ts` — `api = ky.extend({baseUrl: serverUrl, prefix: "/api"})`; `beforeRequest` sets
  `await getValidToken()`, `afterResponse` refreshes once and retries (`ky.retry`) on a 401. Both sockets call
  `getValidToken()` before every (re)connect. `serverUrl` = `http://localhost:4000` in dev, `window.location.origin` in prod.

### Sim configs: optimistic store + revision signal

- `src/service/configs.service.ts` — module exports: `configs` (`createOptimisticStore` over `GET /configs`),
  `configsRevision()` (`X-Config-Revision`), `refreshConfigs()`, and core `action(function* …)`s `addConfig`,
  `removeConfig`, `startStopConfig`, `shareConfig`, `updateConfig(id, UpdateSimConfig)` (PATCH; spec edits send the
  **whole** spec), `updateConfigType(id, SpecType | null)`. Each writes optimistically (or `affects`), awaits, then
  `refresh(configs)`; call them from handlers. The store lives in a never-disposed module-level `createRoot` —
  **never create it from a component** (it died on logout unmount). It tracks `authSession()` (refetch on login,
  `[]` logged out); other per-user module state must do the same.
- **No auto-revalidation on remote changes.** `components/RevisionStatus.tsx` (in `Nav`) owns the `/api/status/ws`
  socket: it stores `{configsRevision}` in `statusConfigsRevision`; when that exceeds `configsRevision()` it shows a
  refresh button. Its icon turns red while disconnected.
- Don't `deep()`/`snapshot()` rows of the configs store (froze the tab on rc.21); copy fields by plain reads instead.
- `src/service/simulation.service.ts` — live `SimData` only. `addSimulationListener(id, cb)` lazily opens one
  ref-counted WebSocket per sim (`/api/sims/:id/ws?token=`) and returns an unsubscribe.
- **Both sockets reconnect** on a server-side close with exponential backoff (1 s → 30 s). A close is ignored when
  the socket is no longer the registered one — intentional closes must deregister *before* calling `close()`.

### Sims page and map

- `pages/sims/Sims.tsx` — selection lives in the URL; the config is derived from `configs` (unknown id → effect
  redirects to `/sims`, `replace`). `SimList.tsx`: `SimForm` + DaisyUI `list` (row click toggles `/sims` ↔ `/sims/:id`).
- `SimDetails.tsx` — `SimCard` above the map; provides **`MapContext`** (accessor of the loaded map). Creates the map
  in `onSettled` inside a rAF (setup is >10 ms → `HOT_SCOPE_TIME`). Its effect tracks only `simConfig?.id` →
  `attachSim(id)`, so spec edits never resubscribe the socket. Cleanup defers `map.remove()` to a microtask so editors
  detach from a live map; a map loading after unmount is disposed.
- `simulationMap.ts` — imperative MapLibre wrapper outside Solid: map setup and the red current-position marker
  (← `SimData.position.{longitude,latitude}`). Resolves only after `load` (don't guard on `map.loaded()`, it's false
  while tiles load). MapLibre 6 (`MapLibreMap`): `setWorkerUrl` (blob of the raw worker in dev, `?worker&url` in
  prod), a missing-image resolver adding a transparent pixel, JWT via `transformRequest` (synchronous, reads the stored token per request — kept fresh by `auth.ts`'s timer).
- `SimCard.tsx` — selected sim only: left card (label, type `<select>`, share/copy/token link, Delete with "Really?"),
  right card (only with a spec: Play/Stop + `<SpecEditor>`). The type select keeps a **draft signal**
  (`createSignal(() => prop)`) so the binding doesn't write the old value back mid-request. Labels aren't ids.

### Spec editors (`components/sims/editors/`)

One Solid component per spec type, registered in `SpecEditor.tsx` (`specEditors: {[K in SpecType]: Component<…>}`
— a new type fails to compile until it has one). `SpecEditor` waits for the map from `MapContext` and mounts the
editor via `dynamic(() => specEditors[type])`. An editor gets `{configId, spec, updatedAt, map}` (pass `map={map()}` — never `untrack` it, every editor tracks
`props.map`) and owns its map objects, a draft and its UI.

**Solid ↔ MapLibre rules** (`createEffect(compute, apply)`; `apply` already runs untracked):
- **compute reads, apply acts.** Every reactive input (incl. `props.map`) is read in compute, which returns plain
  data (copied tuples, no store proxies). apply touches only its argument and non-reactive locals (`marker`,
  `terraDraw`, `drawn`). A reactive read in apply triggers `STRICT_READ_UNTRACKED` — move it, don't `untrack` it.
- **`untrack` only in compute/memos to choose dependencies** (PathEditor's `saved`, `fitBounds`); in apply it only
  hides the warning, in event handlers/rAF it's a no-op.
- **One effect per concern:** a mount effect (`() => props.map` → add objects + listeners, cleanup removes them
  all, incl. `map.off(...)`) and sync effects (data → `setLngLat`/redraw). **Declare the position effect before
  the mount effect** — `Marker.addTo` needs a position, so mount reads none.
- Map events write signals (no owner → reads/writes are fine). The imperative object is the source of truth for
  its own state (`terraDraw.getMode()`), don't read signals back to learn it. rAF callbacks check the instance is
  still current (`if (terraDraw !== draw) return`).
- **Drafts:** `createSignal(() => toDraft(props.spec))`, a plain copy that follows the spec after save/remote
  updates (unsaved edits dropped). Save → `updateConfig(id, {spec: {...props.spec, ...draft()}})`.
- **Signal writes commit on the next flush**: `setDraft(x); draft()` still returns the old value — pass `x` along.

Types:
- `FixedEditor` — **no draft**: a map click saves `position` (optimistic); the default marker follows `props.spec`.
- `OrbitEditor` — blue center moves the orbit, green start sets `radius`/`startAngle` (`geoUtils`); `speed` slider;
  Reset/Save. Nothing saves on drag.
- `PathEditor` — plain **Terra Draw** + `TerraDrawMapLibreGLAdapter`. Mode buttons `select` (default; drag
  line/vertices, midpoints, delete vertices), `linestring`, `freehand-linestring`; clicking the active one switches
  to render-only `default`. A `mode` effect tracks `{map, mode}` (map only so a new TerraDraw gets its mode). A
  `finish` event sets `waypoints`/`editMode`, then (next frame) resets the mode and **autosaves** if the Autosave
  checkbox is on (default). The draft (waypoints, speed, editMode, playMode Single/Loop/Reversing) follows a `saved`
  memo that copies the spec **untracked**, keyed on the spec object + `updatedAt` (tracking every tuple made hundreds
  of sources); **Undo** resets to it. Redraws only if the draft differs from `drawn`; coordinates rounded to 9
  significant digits for Terra Draw; Save needs ≥ 2 waypoints. `fitBounds` (`boundsOf`) on map/config change.
  Cleanup calls `terraDraw.stop()` only if the map hasn't fired `remove` (the adapter's `clear()` crashes after it).

Coordinates are `[lng, lat]`; `getLngLat().toArray()` yields that; spread readonly tuples into `setLngLat`.

### Sessions

`src/service/sessions.service.ts` — `fetchOwnSessions()`, `fetchUserSessions(userId)` router `query()`s;
`revokeOwnSession(id)`, `revokeUserSession(userId, id)` revalidate both (an admin's own sessions are in both).
`components/sessions/SessionList.tsx` (`describeUserAgent` → "Firefox on macOS"; the `current` row gets Log out instead
of Revoke). Shown on `Home` (own) and in `UserDetail` (admin only), each in its own `Loading`.

### Users

`src/service/users.service.ts` — `fetchUsers`, `fetchUser(id: number)` router `query()`s; `addUser(form)`,
`updateUser(id, form)`, `deleteUser(id)` plain async functions that `revalidate` both query keys themselves (the
router doesn't revalidate after plain fetches). Forms call them from `onSubmit` (with `preventDefault`), Delete from
`onClick`. Components in `components/users/` are typed on `User`.

**No router `formAction`s.** Without server functions they only render `action="https://action/<name>"` and resolve it
through a registry; a miss (e.g. a component-scoped action not registered yet) falls through to a native POST to that
URL. Use plain submit handlers calling service functions / core `action`s.

### Server types

Import DTO types from `@sensor-sim/shared` (`SimConfig`, `UpdateSimConfig`, `Spec`, `SpecType`,
`SpecFixed`/`SpecPath`/`SpecOrbit`, `SimData`, `GeoPosition`, `StatusMessage`, `User`, `Profile`). No dependency on
`@sensor-sim/server`. Shared ships **source**: schema changes break `tsc` here immediately, renamed routes don't.
Importing its Zod schemas pulls `zod` into the bundle.

## Env vars

`VITE_MAP_STYLE` — MapLibre style URL; falls back to `<origin>/api/tiles/style.json` (the server picks the
tile provider; the frontend doesn't know which). `transformRequest` adds the JWT to every request on the
style URL's origin (in dev `:4000`, not the page's `:3000`).

## Versioned skills (in node_modules — read on demand)

- `node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md` — maps every dev diagnostic code
  (`REACTIVE_WRITE_IN_OWNED_SCOPE`, `STRICT_READ_UNTRACKED`, …) to its fix. Read it whenever one appears.
- `node_modules/@solidjs/diagnostics/skills/agent-loops/SKILL.md` — capturing reactive evidence and asserting budgets.

## Reactive diagnostics — capture evidence instead of guessing

Tests: `captureArtifact()` + `@solidjs/diagnostics/vitest` matchers. Dev server (needs `diagnostics: true` in
`vite.config.ts`, currently `false`): `GET /__solid/diagnostics`; `POST {"method":"begin"|"end"|"costs"|"whyDidRun"}`.
Otherwise wrap `console.warn` and capture `new Error().stack` to find the offending effect.
Name signals/memos/effects (`{ name: "..." }`) — attribution reports scopes by name. Solid 2.0 batches DOM updates:
tests must `flush()` after firing events before asserting.
