# packages/server

Standalone Node.js simulation engine (`@sensor-sim/server`), a single Hono app served over one HTTP server via `@hono/node-server`. Listens on `PORT` (default `4000`). In production this same process also serves the built frontend (see "Static frontend serving" below).

## Source layout (`src/`)

- `index.ts` — app bootstrap: creates the simulation service, mounts routes, sets up CORS (dev only), serves the built frontend, starts the combined HTTP+WS server. Exports `simulationService` (module-level singleton, imported by route handlers) and `AppType` (the Hono route tree, used by the frontend's `hc<AppType>` typed client).
- `schema.ts` — Zod schemas/types for all REST inputs (`simConfigInput`, `simIdInput`, `simUpdateTargetInput`, `simUpdateCurrentInput`).
- `types.ts` — core domain types: `Position`, `SimConfig`, `SimState`, `Simulation` (`{ config, state }`).
- `simulationService.ts` — top-level orchestrator. Owns the `Map<id, SimulationRuntime>`, persists `SimConfig`s via `storage.ts`, loads persisted sims on startup, and exposes `create` / `remove` / `updateTarget` / `updateCurrent` / `startSim` / `stopSim` / `list` / `get` / `getSimStream` / `simListStream`. Also runs a 200ms interval to periodically re-emit the sim list (keeps clients' snapshots fresh even without config changes).
- `simulationRuntime.ts` — per-simulation engine (`createSimulationRuntime`). Owns the tick loop (`setInterval`, 200ms) that advances `SimState` for `follow` (move toward a target) and `circle` (orbit a center) modes, using `util/getPosition.ts` for geodesic math. Exposes `configure`, `updateTarget`, `updateCurrent`, `start`, `stop`, and a per-sim `simStream` (`EventStream<Simulation>`).
- `storage.ts` — `unstorage` fs-driver wrapper; persists `SimConfig` under `sims:<id>` keys in `STORAGE_DIR` (default `./data/storage`) so simulations survive server restarts.
- `util/eventStream.ts` — `createEventStream(getSnapshot)`: a tiny pub/sub used for both the sim-list stream and per-sim streams; `.collect()` returns an async generator consumed by WebSocket handlers.
- `util/getPosition.ts` — geodesic helpers (position from distance+azimuth, and the reverse) built on `geolib`/`@turf/turf`.
- `util/randomOffset.ts` — generates a random target near a base point (used for default sim creation).
- `routes/sims.ts` — REST API, mounted at `/api/sims`.
- `routes/simsWebsocket.ts` — raw WebSocket API, mounted at `/ws/sims`.
- `routes/maptiler.ts` — MapTiler reverse proxy, mounted at `/api/maptiler`, keeps the MapTiler API key server-side.

## REST API (`src/routes/sims.ts`, mounted at `/api/sims`)

| Method | Path             | Body                          | Notes                                    |
|--------|------------------|-------------------------------|-------------------------------------------|
| GET    | `/`              | —                              | List all `Simulation[]`                   |
| GET    | `/list`          | —                              | Same as `/` (alias). Must stay registered *before* `/:id` — Hono matches in registration order, so a sim whose id is literally `list` is unreachable via `/:id` |
| GET    | `/:id`           | —                              | Single `Simulation`, 404 if missing        |
| POST   | `/create`        | `simConfigInput`               | `type`: `follow` \| `circle`               |
| POST   | `/updateTarget`  | `simUpdateTargetInput`         | Move target (follow: recomputes distance/azimuth from current position; circle: restarts orbit) |
| POST   | `/updateCurrent` | `simUpdateCurrentInput`        | Teleport current position, recompute state |
| POST   | `/start`         | `simIdInput`                   | Resume a stopped sim                       |
| POST   | `/stop`          | `simIdInput`                   | Pause a sim (keeps config, clears state)   |
| POST   | `/delete`        | `simIdInput`                   | Remove sim + persisted config              |

The frontend consumes this via a typed Hono client (`hc<AppType>`), so route/schema changes here directly affect frontend types.

## WebSocket API (`src/routes/simsWebsocket.ts`, mounted at `/ws/sims`)

| Path            | Payload        | Update trigger                                              |
|-----------------|----------------|--------------------------------------------------------------|
| `/ws/sims`      | `Simulation[]` | Any config/state change, plus a 200ms heartbeat re-emit       |
| `/ws/sims/:id`  | `Simulation`   | Every position tick (200ms) while that sim is playing         |

Each connection consumes an async-generator stream (`EventStream.collect()`) and immediately starts receiving snapshots on open; no request/response — it's push-only.

## Static frontend serving (`src/index.ts`)

The server can serve the built frontend from the same origin/process, checked in this order:
1. `dist/public` — copied in by `scripts/copy-frontend.mjs` during `pnpm build`, making a built `dist/` a self-contained deployable artifact.
2. `../../frontend/dist/client` — the frontend package's own build output, used when running from source in the monorepo.

If found, all unmatched GET requests fall back to `index.html` (SPA routing support for Solid Router deep links).

## Map proxy (`src/routes/maptiler.ts`)

`GET /api/maptiler/:path` forwards to `https://api.maptiler.com/:path`, injecting `MAPTILER_KEY` server-side, rewriting absolute MapTiler URLs in JSON responses (style.json, tiles.json) back to this proxy, and stripping any client-supplied `key` query param.

## Env vars

- `PORT` — HTTP port (default `4000`)
- `NODE_ENV` — `development` enables CORS for `http://localhost:3000` (Vite dev server)
- `STORAGE_DIR` — persisted sim config directory (default `./data/storage`)
- `MAPTILER_KEY` — required for the map proxy to function

## Dev & build

```bash
pnpm dev        # tsx watch src/index.ts (hot reload)
pnpm typecheck  # tsc --noEmit
pnpm build      # builds frontend, typechecks, tsup → dist/, copies frontend into dist/public
pnpm start      # node dist/index.js
```
