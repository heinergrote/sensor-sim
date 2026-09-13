import {hc} from 'hono/client'
import {AppType, Simulation} from "@sensor-sim/server";
import {createStore, reconcile} from "solid-js";

export type SimulationsListener = (simulations: readonly Simulation[]) => void

// The server is always reachable at a single, fixed origin: in development
// the Hono server runs standalone on :4000 (separate from the Vite dev
// server on :3000), and in production the server serves the built frontend
// itself, so client and server share the same origin.
export const serverUrl = import.meta.env.DEV ? "http://localhost:4000" : window.location.origin;

export const honoClient = hc<AppType>(serverUrl);

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


