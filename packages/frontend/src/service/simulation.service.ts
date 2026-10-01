import {serverUrl} from "../api";
import {jwtToken} from "../auth";
import {SimData} from "@sensor-sim/shared";

export type SimulationListener = ((simState: SimData) => void)

const RECONNECT_MIN_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 30000

const simulationListeners = new Map<number, SimulationListener[]>()
const simulationSockets = new Map<number, WebSocket>()
const reconnectTimers = new Map<number, ReturnType<typeof setTimeout>>()

function openSocket(simulationId: number, reconnectDelay = RECONNECT_MIN_DELAY_MS) {
  const wsUrl = `${serverUrl}/api/sims/${simulationId}/ws?token=${jwtToken()}`;
  const simSocket = new WebSocket(wsUrl)

  simSocket.onmessage = (event) => {
    // connection works again, so the next drop starts with the short delay
    reconnectDelay = RECONNECT_MIN_DELAY_MS
    const receivedSimState = JSON.parse(event.data) as SimData
    const listeners = simulationListeners.get(simulationId) || []
    listeners.forEach(l => l(receivedSimState))
  }

  // the server closes the socket when the sim is deleted or restarts; reconnect with backoff while anyone is
  // still listening (a deleted sim's listener is removed once the config list revalidates)
  simSocket.onclose = () => {
    // closed on purpose by removeSimulationListener, or already replaced
    if (simulationSockets.get(simulationId) !== simSocket) return

    simulationSockets.delete(simulationId)
    if (!simulationListeners.get(simulationId)?.length) return

    reconnectTimers.set(simulationId, setTimeout(() => {
      reconnectTimers.delete(simulationId)
      if (!simulationListeners.get(simulationId)?.length || simulationSockets.has(simulationId)) return
      openSocket(simulationId, Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS))
    }, reconnectDelay))
  }

  simulationSockets.set(simulationId, simSocket)
}

export function addSimulationListener(
  simulationId: number,
  newListener: SimulationListener = (() => {
  })): () => void {

  const listenersForId = simulationListeners.get(simulationId) || []

  if (!simulationSockets.has(simulationId) && !reconnectTimers.has(simulationId)) {
    openSocket(simulationId)
  }

  simulationListeners.set(simulationId, [...listenersForId, newListener])
  return () => removeSimulationListener(simulationId, newListener)
}

function removeSimulationListener(simulationId: number, listener: SimulationListener) {
  const listeners = simulationListeners.get(simulationId) || []
  let newListeners = listeners.filter(l => l !== listener)

  if (newListeners.length === 0) {
    clearTimeout(reconnectTimers.get(simulationId))
    reconnectTimers.delete(simulationId)
    const simSocket = simulationSockets.get(simulationId)
    simulationSockets.delete(simulationId)
    simSocket?.close()
  }

  simulationListeners.set(simulationId, newListeners)
}
