import type { Position } from "./types.js";

type WatchEntry = {
  success: PositionCallback;
  error?: PositionErrorCallback | null;
};

const POSITION_UNAVAILABLE = 2;

function buildPosition(position: Position): GeolocationPosition {
  const coords: GeolocationCoordinates = {
    latitude: position.latitude,
    longitude: position.longitude,
    accuracy: 5,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON() {
      return { ...this };
    },
  };
  return {
    coords,
    timestamp: Date.now(),
    toJSON() {
      return { coords: coords.toJSON(), timestamp: this.timestamp };
    },
  };
}

function buildPositionUnavailableError(): GeolocationPositionError {
  return {
    code: POSITION_UNAVAILABLE,
    message: "sensor-mock: no position received yet",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
}

/**
 * Patches `navigator.geolocation` so `getCurrentPosition`/`watchPosition`
 * resolve with positions supplied via `pushPosition`, instead of hitting the
 * real device/browser GPS. Idempotent: calling twice is a no-op until
 * `restore()` is called.
 */
export function patchGeolocation() {
  const original = navigator.geolocation;
  let current: Position | null = null;
  const watchers = new Map<number, WatchEntry>();
  let nextWatchId = 1;

  const mock: Geolocation = {
    getCurrentPosition(success, error) {
      if (current) {
        success(buildPosition(current));
      } else {
        error?.(buildPositionUnavailableError());
      }
    },
    watchPosition(success, error) {
      const id = nextWatchId++;
      watchers.set(id, { success, error });
      if (current) success(buildPosition(current));
      return id;
    },
    clearWatch(id) {
      watchers.delete(id);
    },
  };

  Object.defineProperty(navigator, "geolocation", {
    value: mock,
    configurable: true,
  });

  return {
    /** Feed a freshly received position to all active watchers. */
    pushPosition(position: Position | null) {
      current = position;
      if (!position) return;
      const built = buildPosition(position);
      for (const { success } of watchers.values()) success(built);
    },
    /** Restores the original `navigator.geolocation`. */
    restore() {
      watchers.clear();
      Object.defineProperty(navigator, "geolocation", {
        value: original,
        configurable: true,
      });
    },
  };
}
