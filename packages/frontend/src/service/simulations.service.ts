import {SimConfig, Status} from "@sensor-sim/server";
import {createStore, reconcile} from "solid-js";
import {honoClient} from "../honoClient";
import {action, query, revalidate} from "@solidjs/router";


const statusSocket = honoClient.ws.sims.status.$ws()
let lastSimListChangeAt = 0
statusSocket.onmessage = (event) => {
  const newStatus = JSON.parse(event.data) as Status
  setStatus(reconcile(newStatus))

  // always refetch simulations, when simulation status changes
  if (newStatus.simListUpdatedAt > lastSimListChangeAt) {
    lastSimListChangeAt = newStatus.simListUpdatedAt
    revalidate("simulations")
  }
}

export const [status, setStatus] = createStore<Status>({
  startedAt: 0,
  simListUpdatedAt: 0,
  numSims: 0
})

export const fetchSimulations = query(async () => {
  const response = await honoClient.api.sims.$get();
  if (!response.ok) throw new Error(`Could not load simulations`);
  return response.json();
}, "simulations");

export const addSim = action(async (form: FormData) => {
  const response = await honoClient.api.sims.$post({
    json: {
      id: form.get("simId") as string,
      type: form.get("type") as "follow" | "circle",
    }
  });
  if (!response.ok) throw new Error(`Could not add simulation`);
  return response.json();
})

export const updateSim = action(async (id: string, config: Partial<SimConfig>) => {
  const res = await honoClient.api.sims[":id"].$put({
    param: {id},
    json: config
  })
  if (!res.ok) throw new Error("Failed to create simulation")
  return res.json()
})

export const deleteSim = action(async (id: string) => {
  const res = await honoClient.api.sims[":id"].$delete({param: {id}})
  if (!res.ok) throw new Error("Failed to delete simulation")
  return res.json()
})

export const startSim = action(async (id: string) => {
  const res = await honoClient.api.sims[":id"].start.$put({param: {id}})
  if (!res.ok) throw new Error("Failed to start simulation")
  return res.json()
})

export const stopSim = action(async (id: string) => {
  const res = await honoClient.api.sims[":id"].stop.$put({param: {id}})
  if (!res.ok) throw new Error("Failed to stop simulation")
  return res.json()
})

export const updateType = action(async (id: string, type: "follow" | "circle") => {
  const res = await honoClient.api.sims[":id"].$put({
    param: {id},
    json: {type}
  })
  if (!res.ok) throw new Error("Failed to update simulation type")
  return res.json()
})

export const updateSpeed = action(async (id: string, speed: number) => {
  const res = await honoClient.api.sims[":id"].$put({
    param: {id},
    json: {speed}
  })
  if (!res.ok) throw new Error("Failed to update simulation speed")
  return res.json()
})

export const updateCurrent = action(async (id: string, latitude: number, longitude: number) => {
  const res = await honoClient.api.sims[":id"].updateCurrent.$put({
    param: {id},
    json: {latitude, longitude}
  })
  if (!res.ok) throw new Error("Failed to update simulation current position")
  return res.json()
})


export const share = action(async (id: string) => {
  const res = await honoClient.api.sims[":id"].share.$post({
    param: {id}
  })
  if (!res.ok) throw new Error("Failed to create share token")
  return res.json()
})



