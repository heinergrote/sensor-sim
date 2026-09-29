import {SimConfigDto, StatusMessage, UpdateSimConfigDto} from "@sensor-sim/shared";
import {createEffect, createRoot} from "solid-js";
import {api, serverUrl} from "../api";
import {action, query, revalidate} from "@solidjs/router";
import {jwtToken, useAuth} from "../auth";

const RECONNECT_MIN_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 30000

const _dispose = createRoot(dispose => {
  const {user} = useAuth()
  let lastConfigListUpdatedAt = 0
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
        // always refetch configs, when configs status changes
        if (statusMessage.updatedAt > lastConfigListUpdatedAt) {
          lastConfigListUpdatedAt = statusMessage.updatedAt
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
  return api.get<SimConfigDto[]>(`/configs`).json()
}, "simConfigs");


export const fetchSimConfig = query(async (id: number) => {
  return api.get<SimConfigDto>(`/configs/${id}`).json()
}, "simConfig");


export const addSimConfig = action(async (form: FormData) => {
  return api.post<SimConfigDto>(`/configs`, {
    json: {
      type: form.get("type") as "follow" | "circle",
      label: form.get("label") as string
    }
  }).json()
})

export const updateSimConfig = action(async (id: number, config: UpdateSimConfigDto) => {
  return api.patch<SimConfigDto>(`/configs/${id}`, {
    json: config
  }).json()
})

export const deleteSimConfig = action(async (id: number) => {
  return api.delete<SimConfigDto>(`/configs/${id}`).json()
})

export const startSim = action(async (id: number) => {
  return api.put(`/configs/${id}/start`).json()
})

export const stopSim = action(async (id: number) => {
  return api.put(`/configs/${id}/stop`).json()
})

export const updateType = action(async (id: number, type: "follow" | "circle") => {
  return api.patch<SimConfigDto>(`/configs/${id}`, {
    json: {type}
  }).json()
})

export const updateSpeed = action(async (id: number, speed: number) => {
  return api.patch<SimConfigDto>(`/configs/${id}`, {
    json: {speed}
  }).json()
})

export const share = action(async (id: number) => {
  return api.post<{ token: string, expiryDate: Date }>(`/configs/${id}/share`).json()
})

export const unShare = action(async (id: number) => {
  return api.post<{ success: boolean }>(`/configs/${id}/unshare`).json()
})


