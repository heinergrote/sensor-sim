import {CONFIG_REVISION_HEADER, SimConfig, SpecType, specTypesSchema, StatusMessage, UpdateSimConfig} from "@sensor-sim/shared";
import {action, createEffect, createRoot} from "solid-js";
import {api, serverUrl} from "../api";
import {formAction, query, revalidate} from "@solidjs/router";
import {jwtToken, useAuth} from "../auth";

const RECONNECT_MIN_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 30000

// highest config revision this client has fetched the list at (or been told about); see CONFIG_REVISION_HEADER
let knownConfigRevision = 0

const _dispose = createRoot(dispose => {
  const {user} = useAuth()
  let wss: WebSocket | undefined
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined

  function disconnect() {
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
    const socket = wss
    wss = undefined // before close(), so its onclose doesn't reconnect
    socket?.close()
  }

  function connect(reconnectDelay = RECONNECT_MIN_DELAY_MS, isReconnect = false) {
    const socket = new WebSocket(`${serverUrl}/api/status/ws?token=${jwtToken()}`)
    wss = socket

    socket.onopen = () => {
      reconnectDelay = RECONNECT_MIN_DELAY_MS
      // config changes while disconnected were missed
      if (isReconnect) revalidate(fetchSimConfigs.key)
    }

    socket.onmessage = (event) => {
      const statusMessage = JSON.parse(event.data) as StatusMessage

      if (statusMessage.type === "configUpdate") {
        // refetch only if the list is older than the change, e.g. not after this tab's own mutation
        // (the action already revalidated, and that fetch carried the new revision)
        if (statusMessage.revision > knownConfigRevision) {
          knownConfigRevision = statusMessage.revision
          revalidate(fetchSimConfigs.key)
        }

      }

    }

    // the server closes it on restart; reconnect with backoff unless we closed it ourselves
    socket.onclose = () => {
      if (wss !== socket) return
      wss = undefined
      reconnectTimer = setTimeout(
        () => connect(Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS), true),
        reconnectDelay
      )
    }
  }

  // (re)connect whenever the token changes, so a page loaded before login
  // (or a login/logout cycle) doesn't leave this socket permanently unauthenticated
  createEffect(() => user(),
    (user) => {
      disconnect()
      if (user) connect()
    })

  return () => {
    disconnect()
    dispose()
  };

});


export const fetchSimConfigs = query(async () => {
  const response = await api.get<SimConfig[]>(`/configs`)
  const revision = Number(response.headers.get(CONFIG_REVISION_HEADER))
  if (revision > knownConfigRevision) knownConfigRevision = revision
  return response.json()
}, "simConfigs");


export const fetchSimConfig = query(async (id: number) => {
  return api.get<SimConfig>(`/configs/${id}`).json()
}, "simConfig");


// Button-triggered mutations are router form actions, bound via <form action={...}> / formaction.
// The router revalidates queries after each one.

export const addSimConfig = formAction(async (form: FormData) => {

  return api.post<SimConfig>(`/configs`, {
    json: {
      label: form.get("label") as string
    }
  }).json()
})

export const deleteSimConfig = formAction(async (id: number) => {
  return api.delete<SimConfig>(`/configs/${id}`).json()
})

export const startSim = formAction(async (id: number) => {
  return api.put(`/configs/${id}/start`).json()
})

export const stopSim = formAction(async (id: number) => {
  return api.put(`/configs/${id}/stop`).json()
})

export const share = formAction(async (id: number) => {
  return api.post<{ token: string, expiryDate: Date }>(`/configs/${id}/share`).json()
})

export const unShare = formAction(async (id: number) => {
  return api.post<{ success: boolean }>(`/configs/${id}/unshare`).json()
})

// Mutations called from code (map drags, sliders, selects) are core actions: plain callables that know
// nothing about the router, so they revalidate the config list themselves.

export const updateSimConfig = action(async function* (id: number, config: UpdateSimConfig) {
  const result = await api.patch<SimConfig>(`/configs/${id}`, {
    json: config
  }).json()
  yield // re-enter the transaction before touching reactive state
  revalidate(fetchSimConfigs.key)
  return result
})

export const updateType = action(async function* (id: number, type: SpecType | null) {
  const parsedType = specTypesSchema.safeParse(type).data ?? null

  const result = parsedType
    // type valid: update using type endpoint
    ? await api.put<SimConfig>(`/configs/${id}/type`, {
      json: {type: parsedType}
    }).json()
    // type invalid: remove spec
    : await api.patch<SimConfig>(`/configs/${id}`, {
      json: {spec: null}
    }).json()
  yield // re-enter the transaction before touching reactive state
  revalidate(fetchSimConfigs.key)
  return result
})
