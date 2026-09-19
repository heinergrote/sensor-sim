import {SimConfig, Simulation, Status} from "@sensor-sim/server";
import {createEffect, createRoot, createStore, reconcile} from "solid-js";
import {api, serverUrl} from "../api";
import {action, query, revalidate} from "@solidjs/router";
import {jwtToken, useAuth} from "../auth";


let lastSimListChangeAt = 0
let wss: WebSocket | undefined

const dispose = createRoot(dispose => {
  const {user} = useAuth()

  // (re)connect whenever the token changes, so a page loaded before login
  // (or a login/logout cycle) doesn't leave this socket permanently unauthenticated
  createEffect(() => user(),
    (user) => {
      wss?.close()
      if (!user) return

      wss = new WebSocket(`${serverUrl}/api/status/ws?token=${jwtToken()}`)
      wss.onmessage = (event) => {
        const newStatus = JSON.parse(event.data) as Status
        setStatus(reconcile(newStatus))

        // always refetch simulations, when simulation status changes
        if (newStatus.simListUpdatedAt > lastSimListChangeAt) {
          lastSimListChangeAt = newStatus.simListUpdatedAt
          revalidate("simulations")
        }
      }
    })

  return dispose;
});


export const [status, setStatus] = createStore<Status>({
  startedAt: 0,
  simListUpdatedAt: 0,
  numSims: 0
})

export const fetchSimulations = query(async () => {
  return api.get<Simulation[]>(`/sims`).json()
}, "simulations");

export const addSim = action(async (form: FormData) => {
  return api.post<Simulation>(`/sims`, {
    json: {
      id: form.get("simId") as string,
      type: form.get("type") as "follow" | "circle",
    }
  }).json()
})

export const updateSim = action(async (id: string, config: Partial<SimConfig>) => {
  return api.put<Simulation>(`/sims/${id}`, {
    json: config
  }).json()
})

export const deleteSim = action(async (id: string) => {
  return api.delete<Simulation>(`/sims/${id}`).json()
})

export const startSim = action(async (id: string) => {
  return api.put(`/sims/${id}/start`).json()
})

export const stopSim = action(async (id: string) => {
  return api.put(`/sims/${id}/stop`).json()
})

export const updateType = action(async (id: string, type: "follow" | "circle") => {
  return api.put(`/sims/${id}`, {
    json: {type}
  }).json()
})

export const updateSpeed = action(async (id: string, speed: number) => {
  return api.put(`/sims/${id}`, {
    json: {speed}
  }).json()
})

export const updateCurrent = action(async (id: string, latitude: number, longitude: number) => {
  return api.put(`/sims/${id}/updateCurrent`, {
    json: {latitude, longitude}
  }).json()
})


export const share = action(async (id: string) => {
  return api.post<{ token: string, expiryDate: Date }>(`/sims/${id}/share`).json()
})

export const unShare = action(async (id: string) => {
  return api.post<{ success: boolean }>(`/sims/${id}/unshare`).json()
})


