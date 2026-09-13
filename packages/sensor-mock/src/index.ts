import { createSimClient, type SimClient } from "./client.js";
import { patchGeolocation } from "./geolocation.js";
import { createOverlay, type Overlay } from "./overlay.js";
import type {
  Position,
  SensorMockHandle,
  SensorMockOptions,
  SensorMockStatus,
} from "./types.js";

const IDLE_STATUS: SensorMockStatus = { enabled: false, connection: "idle", position: null };

export type {
  Position,
  SensorMockHandle,
  SensorMockOptions,
  SensorMockStatus,
  ConnectionStatus,
} from "./types.js";

/**
 * Module-level singleton: `navigator.geolocation` is a single global object,
 * so only one sensor-mock instance can be active at a time. Calling
 * `enableSensorMock` again fully tears down any previous instance first.
 */
let activeInstance: {
  options: SensorMockOptions;
  status: SensorMockStatus;
  listeners: Set<(status: SensorMockStatus) => void>;
  overlay: Overlay | null;
  client: SimClient | null;
  patch: ReturnType<typeof patchGeolocation> | null;
} | null = null;

function notify() {
  if (!activeInstance) return;
  const snapshot: SensorMockStatus = { ...activeInstance.status };
  for (const listener of activeInstance.listeners) listener(snapshot);
  activeInstance.overlay?.update(snapshot);
}

/** Starts (or restarts) the WebSocket connection + geolocation patch. */
function start() {
  if (!activeInstance || activeInstance.client) return;
  const { options } = activeInstance;

  const patch = patchGeolocation();
  const client = createSimClient(options.serverUrl, options.simId);
  client.subscribe((position: Position | null, connection) => {
    if (!activeInstance) return;
    activeInstance.status.position = position;
    activeInstance.status.connection = connection;
    patch.pushPosition(position);
    notify();
  });

  activeInstance.patch = patch;
  activeInstance.client = client;
  activeInstance.status.enabled = true;
  activeInstance.status.connection = client.status;
  activeInstance.status.position = client.latestPosition;
  notify();
}

/** Stops the WebSocket connection and restores the real geolocation, keeping the overlay/listeners intact. */
function stop() {
  if (!activeInstance) return;
  activeInstance.client?.close();
  activeInstance.patch?.restore();
  activeInstance.client = null;
  activeInstance.patch = null;
  activeInstance.status.enabled = false;
  activeInstance.status.connection = "disconnected";
  notify();
}

/**
 * Patches `navigator.geolocation` with live positions streamed from a
 * sensor-sim server simulation, so any code using the standard Geolocation
 * API receives mocked coordinates.
 */
export function enableSensorMock(options: SensorMockOptions): SensorMockHandle {
  disableSensorMock();

  activeInstance = {
    options,
    status: { enabled: false, connection: "idle", position: null },
    listeners: new Set(),
    overlay: null,
    client: null,
    patch: null,
  };

  if (options.overlay) {
    activeInstance.overlay = createOverlay(() => {
      if (activeInstance?.status.enabled) stop();
      else start();
    });
  }

  start();

  return {
    disable: disableSensorMock,
    get status() {
      return activeInstance ? { ...activeInstance.status } : IDLE_STATUS;
    },
    subscribe(callback) {
      if (!activeInstance) return () => {};
      activeInstance.listeners.add(callback);
      return () => activeInstance?.listeners.delete(callback);
    },
  };
}

/** Fully tears down any active sensor-mock instance: connection, geolocation patch, and overlay. */
export function disableSensorMock(): void {
  if (!activeInstance) return;
  activeInstance.client?.close();
  activeInstance.patch?.restore();
  activeInstance.overlay?.destroy();
  activeInstance.listeners.clear();
  activeInstance = null;
}
