/**
 * Mirrors the sensor-sim server's `Position` shape (see
 * packages/server/src/types.ts) so incoming WebSocket messages can be
 * consumed without any field mapping.
 */
export type Position = {
  latitude: number;
  longitude: number;
};

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type SensorMockStatus = {
  enabled: boolean;
  connection: ConnectionStatus;
  position: Position | null;
};

export type SensorMockOptions = {
  /** Base HTTP(S) or WS(S) URL of the sensor-sim server, e.g. "http://localhost:4000". */
  serverUrl: string;
  /** id of the simulation to stream from `/ws/sims/:id`. */
  simId: string;
  /** Show a small bottom-left status/toggle overlay. Defaults to false. */
  overlay?: boolean;
};

export type SensorMockHandle = {
  /** Restores the original navigator.geolocation and tears down the connection. */
  disable: () => void;
  /** Current status snapshot. */
  readonly status: SensorMockStatus;
  /** Subscribe to status changes. Returns an unsubscribe function. */
  subscribe: (callback: (status: SensorMockStatus) => void) => () => void;
};
