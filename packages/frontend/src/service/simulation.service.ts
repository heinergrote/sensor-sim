import {Simulation} from "@sensor-sim/server";
import {serverUrl} from "../api";
import {jwtToken} from "../auth";

export type SimulationListener = ((simulation: Simulation) => void)

const simulationListeners = new Map<string, SimulationListener[]>()
const simulationSockets = new Map<string, WebSocket>()

export function addSimulationListener(
  simulationId: string,
  newListener: SimulationListener = (() => {
  })): () => void {

  const listenersForId = simulationListeners.get(simulationId) || []

  if (!simulationSockets.has(simulationId)) {
    const wsUrl = `${serverUrl}/api/sims/${simulationId}/ws?token=${jwtToken()}`;
    const simSocket = new WebSocket(wsUrl)
    simSocket.onmessage = (event) => {
      const receivedSim = JSON.parse(event.data) as Simulation
      const listeners = simulationListeners.get(simulationId) || []
      listeners.forEach(l => l(receivedSim))
    }
    simulationSockets.set(simulationId, simSocket)
  }

  simulationListeners.set(simulationId, [...listenersForId, newListener])
  return () => removeSimulationListener(simulationId, newListener)
}

function removeSimulationListener(simulationId: string, listener: SimulationListener) {
  const listeners = simulationListeners.get(simulationId) || []
  let newListeners = listeners.filter(l => l !== listener)

  if (newListeners.length === 0) {
    simulationSockets.get(simulationId)?.close()
    simulationSockets.delete(simulationId)
    console.log("unsubscribed from " + simulationId)
  }

  simulationListeners.set(simulationId, newListeners)
}



