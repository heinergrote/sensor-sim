import {serverUrl} from "../api";
import {jwtToken} from "../auth";
import {SimState} from "@sensor-sim/server";

export type SimulationListener = ((simState: SimState) => void)

const simulationListeners = new Map<number, SimulationListener[]>()
const simulationSockets = new Map<number, WebSocket>()

export function addSimulationListener(
  simulationId: number,
  newListener: SimulationListener = (() => {
  })): () => void {

  const listenersForId = simulationListeners.get(simulationId) || []

  if (!simulationSockets.has(simulationId)) {
    const wsUrl = `${serverUrl}/api/sims/${simulationId}/ws?token=${jwtToken()}`;
    const simSocket = new WebSocket(wsUrl)
    simSocket.onmessage = (event) => {
      const receivedSimState = JSON.parse(event.data) as SimState
      const listeners = simulationListeners.get(simulationId) || []
      listeners.forEach(l => l(receivedSimState))
    }
    simulationSockets.set(simulationId, simSocket)
  }

  simulationListeners.set(simulationId, [...listenersForId, newListener])
  return () => removeSimulationListener(simulationId, newListener)
}

function removeSimulationListener(simulationId: number, listener: SimulationListener) {
  const listeners = simulationListeners.get(simulationId) || []
  let newListeners = listeners.filter(l => l !== listener)

  if (newListeners.length === 0) {
    simulationSockets.get(simulationId)?.close()
    simulationSockets.delete(simulationId)
  }

  simulationListeners.set(simulationId, newListeners)
}



