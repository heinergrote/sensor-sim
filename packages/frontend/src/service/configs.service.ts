import {SimConfigDto, StatusMessage, UpdateSimConfigDto} from "@sensor-sim/server";
import {createEffect, createRoot} from "solid-js";
import {api, serverUrl} from "../api";
import {action, query, revalidate} from "@solidjs/router";
import {jwtToken, useAuth} from "../auth";


const dispose = createRoot(dispose => {
  const {user} = useAuth()
  let lastConfigListUpdatedAt = 0
  let wss: WebSocket | undefined

  // (re)connect whenever the token changes, so a page loaded before login
  // (or a login/logout cycle) doesn't leave this socket permanently unauthenticated
  createEffect(() => user(),
    (user) => {
      wss?.close()
      if (!user) return

      wss = new WebSocket(`${serverUrl}/api/status/ws?token=${jwtToken()}`)
      wss.onmessage = (event) => {
        const statusMessage = JSON.parse(event.data) as StatusMessage

        console.log("statusMessage: ", statusMessage)

        if (statusMessage.type === "configUpdate") {
          // always refetch configs, when configs status changes
          if (statusMessage.updatedAt > lastConfigListUpdatedAt) {
            lastConfigListUpdatedAt = statusMessage.updatedAt
            revalidate(fetchSimConfigs.key)
          }

        }

      }
    })

  return () => {
    wss?.close()
    dispose()
  };

});


export const fetchSimConfigs = query(async () => {
  console.log("fetchSimConfigs")
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

export const updateCurrent = action(async (id: number, latitude: number, longitude: number) => {
  return api.patch<SimConfigDto>(`/configs/${id}/updateCurrent`, {
    json: {latitude, longitude}
  }).json()
})


export const share = action(async (id: number) => {
  return api.post<{ token: string, expiryDate: Date }>(`/configs/${id}/share`).json()
})

export const unShare = action(async (id: number) => {
  return api.post<{ success: boolean }>(`/configs/${id}/unshare`).json()
})


