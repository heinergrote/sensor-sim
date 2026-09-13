# sensor-sim

(Work in progress, but should work)

GPS simulation for testing location-aware apps. Create simulated devices that
move toward a target or orbit a point, watch them live on a map, and feed their
positions into your own app as if they came from a real GPS.

- **[packages/server](packages/server)** — the simulation engine: REST +
  WebSocket API, MapTiler proxy, and in production it serves the UI too.
- **[packages/frontend](packages/frontend)** — the management UI: map and live
  simulation controls (SolidJS 2 + MapLibre).
- **[packages/sensor-mock](packages/sensor-mock)** — published npm library that
  patches `navigator.geolocation` in any web app with a live simulation feed.

## Quick start

```bash
pnpm install
pnpm dev          # server on :4000, UI on :3000
```

Open http://localhost:3000, create a simulation, and drag its markers around
the map. Set `MAPTILER_KEY` in `packages/server/.env` for map tiles — the key
stays server-side, proxied through `/api/maptiler`.

Other root scripts: `pnpm dev:server`, `pnpm dev:frontend`, `pnpm build`.

## Consuming simulated positions

A simulation streams `Simulation` snapshots over `ws://<server>/ws/sims/:id`
every 200 ms, and the full list over `/ws/sims`. Mutations go over REST at
`/api/sims` — see [packages/server/README.md](packages/server/README.md).

To make an existing web app believe it's moving, use the
[sensor-mock](https://www.npmjs.com/package/sensor-mock) library instead of
wiring up the WebSocket yourself:

```ts
import {enableSensorMock} from "sensor-mock";

enableSensorMock({serverUrl: "http://localhost:4000", simId: "my-sim"});
// navigator.geolocation now reports the simulation's position
```

## Deployment

One process serves the API and the built UI on the same origin, so there is a
single image to run:

```bash
docker run -p 4000:4000 -e MAPTILER_KEY=... \
  -v sensor-sim-data:/app/data/storage \
  ghcr.io/heinergrote/sensor-sim:latest
```

Mount a volume at `/app/data/storage` — simulation configs are persisted there
and reloaded on startup. `docker-compose/sensor-sim/compose.yml` does this and
reads `MAPTILER_KEY` / `PORT` from a local `.env`.
