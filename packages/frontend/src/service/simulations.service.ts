import {SimConfig, Simulation} from "@sensor-sim/server";
import {createStore, reconcile} from "solid-js";
import {honoClient} from "../honoClient";

export type SimulationsListener = (simulations: readonly Simulation[]) => void

const socket = honoClient.ws.sims.$ws()
socket.onmessage = (event) => {
  const newSims = JSON.parse(event.data) as Simulation[]
  const newSimIds = newSims.map(sim => sim.config.id)

  latestSimulations = newSims

  setSimulations(reconcile(newSims, (sim) => {
    return sim?.config?.id
  }))

  setSimulationIds(reconcile(newSimIds, null))
  notifySimulationsListeners(newSims)
}

export const [simulationIds, setSimulationIds] = createStore<string[]>([])
export const [simulations, setSimulations] = createStore<Simulation[]>([])

export let latestSimulations: readonly Simulation[] = []

const simulationsListeners = new Set<SimulationsListener>()

export function addSimulationsListener(listener: SimulationsListener): () => void {
  simulationsListeners.add(listener)
  return () => removeSimulationsListener(listener)
}

export function removeSimulationsListener(listener: SimulationsListener) {
  simulationsListeners.delete(listener)
}

export function getSimulation(id: string) {
  return latestSimulations.find((sim) => sim.config.id === id)
}

export function getSimulations() {
  return latestSimulations
}

function notifySimulationsListeners(nextSimulations: readonly Simulation[]) {
  for (const listener of simulationsListeners) {
    listener(nextSimulations)
  }
}

export async function createSim(id: string, type: "follow" | "circle") {
  const res = await honoClient.api.sims.$post({
    json: {id, type}
  })
  if (!res.ok) throw new Error("Failed to create simulation")
  return res.json()
}

export async function updateSim(id: string, config: Partial<SimConfig>) {
  const res = await honoClient.api.sims[":id"].$put({
    param: {id},
    json: config
  })
  if (!res.ok) throw new Error("Failed to create simulation")
  return res.json()
}

export async function deleteSim(id: string) {
  const res = await honoClient.api.sims[":id"].$delete({param: {id}})
  if (!res.ok) throw new Error("Failed to delete simulation")
  return res.json()
}

export async function startSim(id: string) {
  const res = await honoClient.api.sims[":id"].start.$put({param: {id}})
  if (!res.ok) throw new Error("Failed to stop simulation")
  return res.json()
}

export async function stopSim(id: string) {
  const res = await honoClient.api.sims[":id"].stop.$put({param: {id}})
  if (!res.ok) throw new Error("Failed to stop simulation")
  return res.json()
}


export async function updateType(id: string, type: "follow" | "circle") {
  const res = await honoClient.api.sims[":id"].$put({
    param: {id},
    json: {type}
  })
  if (!res.ok) throw new Error("Failed to update simulation type")
  return res.json()
}

export async function updateSpeed(id: string, speed: number) {
  const res = await honoClient.api.sims[":id"].$put({
    param: {id},
    json: {speed}
  })
  if (!res.ok) throw new Error("Failed to update simulation speed")
  return res.json()
}

export async function updateCurrent(id: string, latitude: number, longitude: number) {
  const res = await honoClient.api.sims[":id"].updateCurrent.$put({
    param: {id},
    json: {latitude, longitude}
  })
  if (!res.ok) throw new Error("Failed to update simulation current position")
  return res.json()
}




