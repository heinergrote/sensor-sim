import {hc} from 'hono/client'
import {AppType, Simulation} from "@sensor-sim/server";
import {createEffect, createRoot, createSignal, createStore, reconcile} from "solid-js";

export type HonoClient = ReturnType<typeof hc<AppType>>
export type SimulationsListener = (simulations: readonly Simulation[]) => void

export const STORAGE_KEY = "server_url";
export const [serverUrl, setServerUrl] = createSignal<string>(localStorage.getItem(STORAGE_KEY) || "");
export let honoClient: HonoClient | null = null

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


createRoot(() => {
  createEffect(
    () => serverUrl().trim(),
    (url) => {

      localStorage.setItem(STORAGE_KEY, url);

      honoClient = hc<AppType>(url);

      const wsUrl = url.replace(/^http/, "ws");
      const ws = new WebSocket(`${wsUrl}/ws/sims`)
      ws.onmessage = (event) => {
        const newSims = JSON.parse(event.data) as Simulation[]
        const newSimIds = newSims.map(sim => sim.config.id)

        latestSimulations = newSims

        setSimulations(reconcile(newSims, (sim) => {
          return sim?.config?.id
        }))

        setSimulationIds(reconcile(newSimIds, null))
        notifySimulationsListeners(newSims)
      }
      return () => {
        ws.close();
        honoClient = null;
      };
    });
});
