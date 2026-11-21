import {serverUrl} from "../api";
import {getValidToken, isLoggedIn} from "../auth";
import {SimData} from "@sensor-sim/shared";

export type SimulationListener = ((simState: SimData) => void)

const RECONNECT_MIN_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 30000

const simulationListeners = new Map<number, SimulationListener[]>()
const simulationSockets = new Map<number, WebSocket>()
const reconnectTimers = new Map<number, ReturnType<typeof setTimeout>>()
// sims whose socket is waiting for a fresh access token, so a second listener doesn't open another one
const pendingOpens = new Set<number>()

async function openSocket(simulationId: number, reconnectDelay = RECONNECT_MIN_DELAY_MS) {
  pendingOpens.add(simulationId)
  // the access token is short-lived: get a fresh one for every (re)connect
  const token = await getValidToken()
  pendingOpens.delete(simulationId)
  // all listeners gone meanwhile
  if (!simulationListeners.get(simulationId)?.length || simulationSockets.has(simulationId)) return
  if (!token) {
    // no token although logged in = server unreachable: keep retrying with backoff
    if (isLoggedIn()) scheduleReconnect(simulationId, reconnectDelay)
    return
  }

  const wsUrl = `${serverUrl}/api/sims/${simulationId}/ws?token=${token}`;
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

    scheduleReconnect(simulationId, reconnectDelay)
  }

  simulationSockets.set(simulationId, simSocket)
}

function scheduleReconnect(simulationId: number, reconnectDelay: number) {
  reconnectTimers.set(simulationId, setTimeout(() => {
    reconnectTimers.delete(simulationId)
    if (!simulationListeners.get(simulationId)?.length || simulationSockets.has(simulationId)) return
    void openSocket(simulationId, Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS))
  }, reconnectDelay))
}

export function addSimulationListener(
  simulationId: number,
  newListener: SimulationListener = (() => {
  })): () => void {

  const listenersForId = simulationListeners.get(simulationId) || []

  simulationListeners.set(simulationId, [...listenersForId, newListener])

  // after registering the listener: openSocket checks for listeners once it has its token
  if (!simulationSockets.has(simulationId) && !reconnectTimers.has(simulationId) && !pendingOpens.has(simulationId)) {
    void openSocket(simulationId)
  }
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
