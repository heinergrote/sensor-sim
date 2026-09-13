# sensor-mock

Mock browser sensor APIs — starting with **Geolocation** — with live data
streamed from a running [sensor-sim](https://github.com/heinergrote/sensor-sim)
server simulation. It patches `navigator.geolocation` in place, so any code
using the standard Geolocation API (`getCurrentPosition`, `watchPosition`)
transparently receives mocked coordinates instead of the real device GPS.

This is a drop-in alternative to the sensor-sim Chrome extension for sites
that don't run in a browser you control (or for automated/CI environments) —
just add an npm dependency instead of installing an extension. The name is
generic ("sensor-mock", not "gps-mock") because other mocked sensor types
(accelerometer, orientation, etc.) may be added later.

## Install

```bash
npm install sensor-mock
# or
pnpm add sensor-mock
```

## Usage

```ts
import { enableSensorMock } from "sensor-mock";

const handle = enableSensorMock({
  serverUrl: "http://localhost:4000", // sensor-sim server base URL
  simId: "abc123",                    // simulation id to stream from
  overlay: true,                      // optional bottom-left status widget
});

navigator.geolocation.watchPosition((position) => {
  console.log(position.coords.latitude, position.coords.longitude);
});

// later, to stop mocking and restore the real navigator.geolocation:
handle.disable();
```

Only one sensor-mock instance can be active at a time (`navigator.geolocation`
is a single global object). Calling `enableSensorMock` again automatically
tears down any previous instance first.

## Options

| Option      | Type      | Required | Description                                                        |
|-------------|-----------|----------|---------------------------------------------------------------------|
| `serverUrl` | `string`  | yes      | Base URL of the sensor-sim server (`http(s)://...`), converted to `ws(s)://` internally. |
| `simId`     | `string`  | yes      | id of the simulation to stream from `/ws/sims/:id`.                 |
| `overlay`   | `boolean` | no       | Show a small bottom-left overlay with connection status, current coordinates, and an enable/disable toggle. Defaults to `false`. |

## Handle API

`enableSensorMock` returns a handle:

- `disable()` — restores the real `navigator.geolocation` and closes the connection.
- `status` — current `{ enabled, connection, position }` snapshot.
- `subscribe(callback)` — subscribe to status changes; returns an unsubscribe function.

## Overlay

When `overlay: true`, a minimal, dependency-free widget is mounted in the
bottom-left corner showing mock state, connection status, and current
coordinates, with a button to toggle mocking on/off without losing the
connection or removing the widget.

## Notes

- Zero runtime dependencies; ships as ESM + CJS with type declarations.
- Uses the native `WebSocket` API, so it works in any browser without a bundler.
