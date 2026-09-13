# @sensor-sim/server

The sensor-sim simulation engine: a single Node.js process that runs GPS
simulations, broadcasts their positions over WebSockets, exposes a REST API to
control them, proxies map tiles, and — in production — serves the management
frontend from the same origin.

## Quick start

From the repo root (`pnpm dev` starts this and the frontend together), or here:

```bash
pnpm dev        # tsx watch src/index.ts, hot reload, http://localhost:4000
pnpm typecheck  # tsc --noEmit
pnpm build      # frontend build → typecheck → tsup → dist/, frontend copied into dist/public
pnpm start      # node dist/index.js
```

`pnpm build` deliberately builds `@sensor-sim/frontend` first and copies its
static output into `dist/public` (see `scripts/copy-frontend.mjs`), so a built
`dist/` is a **self-contained server + frontend artifact** that needs no
sibling packages at runtime.

## Environment variables

| Variable        | Default           | Purpose                                                        |
|-----------------|-------------------|----------------------------------------------------------------|
| `PORT`          | `4000`            | HTTP port (shared by REST, WebSockets and static files)         |
| `NODE_ENV`      | —                 | `development` enables CORS for the Vite dev server on `:3000`   |
| `STORAGE_DIR`   | `./data/storage`  | Where simulation configs are persisted (resolved from `cwd`)    |
| `MAPTILER_KEY`  | —                 | Required for `/api/maptiler`; without it the proxy returns 500  |

`.env` files are loaded via `dotenv/config`.

## Simulation model

A simulation is `{ config, state }`:

- **`config`** (`SimConfig`) is the durable part — `id`, `target` position,
  `initialDistance`, `initialAzimuth`, `type`, `speed` (m/s), `playing`. This
  is what gets persisted.
- **`state`** (`SimState | null`) is the live part — `current` position,
  `distance`, `azimuth`, `start` timestamp. It is `null` whenever the
  simulation is stopped, and rebuilt from `config` on every start.

Two movement types, both advanced by a **200 ms tick**:

- **`follow`** — moves `current` straight toward `target` at `speed`, snapping
  to the target on the last step and then sitting there at distance 0.
- **`circle`** — orbits `target` at a fixed radius, rotating `azimuth` by the
  angle that corresponds to `speed × delta` along the circumference.

Position math is geodesic, via `@turf/turf` (`util/getPosition.ts`).

## REST API — `/api/sims`

All inputs are validated with Zod (`src/schema.ts`).

| Method | Path             | Body                    | Result                                                      |
|--------|------------------|-------------------------|-------------------------------------------------------------|
| GET    | `/`              | —                       | `Simulation[]`                                              |
| GET    | `/list`          | —                       | Same as `/`                                                 |
| GET    | `/:id`           | —                       | A single `Simulation`, or `404` with `{ error }` if unknown  |
| POST   | `/create`        | `simConfigInput`        | The created `Simulation`; only `id` is required, everything else gets a default (random target near Braunschweig, random distance/azimuth, `follow`, 20 m/s, playing) |
| POST   | `/updateTarget`  | `{ id, target }`        | Moves the target. `follow` recomputes distance/azimuth from the current position so motion continues smoothly; `circle` restarts the orbit |
| POST   | `/updateCurrent` | `{ id, current }`       | Teleports the current position and recomputes the config from it |
| POST   | `/start`         | `{ id }`                | Resumes a stopped simulation (fresh state from config)       |
| POST   | `/stop`          | `{ id }`                | Pauses it — config is kept and persisted, `state` becomes `null` |
| POST   | `/delete`        | `{ id }`                | Removes the simulation and its persisted config              |

`/list` must stay registered before `/:id` in `routes/sims.ts`, because Hono
matches in registration order. One consequence: a simulation whose id is
literally `list` can't be fetched through `/:id`.

## WebSocket API — `/ws/sims`

| Path            | Payload        | Emitted when                                            |
|-----------------|----------------|---------------------------------------------------------|
| `/ws/sims`      | `Simulation[]` | Any create/update/delete, plus a 200 ms re-emit of the whole list |
| `/ws/sims/:id`  | `Simulation`   | Every tick of that simulation while it is playing        |

Both are **push-only**: a client receives a snapshot as soon as it connects and
then keeps receiving them. There is no request/response and nothing to poll —
messages sent by the client are only logged. Connecting to an unknown sim id
returns `404` before the upgrade.

Under the hood, `util/eventStream.ts` is a small pub/sub whose `.collect()`
returns an async generator; each socket iterates its own generator and releases
it on close.

## Architecture

```
src/index.ts               app bootstrap; exports `simulationService` (module singleton) and `AppType`
src/simulationService.ts   owns Map<id, SimulationRuntime>, persistence, the sim-list stream
src/simulationRuntime.ts   one per simulation: tick loop, movement math, per-sim stream
src/storage.ts             unstorage fs driver; configs under `sims:<id>` in STORAGE_DIR
src/schema.ts              Zod input schemas
src/types.ts               Position, SimConfig, SimState, Simulation
src/routes/                sims (REST), simsWebsocket (WS), maptiler (proxy)
src/util/                  eventStream, getPosition, randomOffset
```

Two things worth knowing before changing anything here:

- **`AppType` is part of the public API.** `index.ts` exports the Hono route
  tree as `AppType`, and `package.json#exports` points at `./src/index.ts`.
  The frontend builds its typed client with `hc<AppType>(serverUrl)` against
  that *source*, so changing a route or a Zod schema changes frontend types
  immediately, with no build in between. Check both sides.
- **Route handlers import the service from `index.ts`.** `simulationService` is
  a module-level singleton created with top-level `await`; routes import it
  rather than receiving it, so import cycles between `index.ts` and
  `routes/*` are load-order sensitive.

Simulation configs are persisted on every mutation and reloaded on startup, so
simulations survive a restart. They come back in whatever `playing` state they
were saved in.

## Serving the frontend

If a frontend build is found, all unmatched `GET`s fall back to its
`index.html` so Solid Router deep links survive a full page load. Two
locations are checked, in order:

1. `dist/public` — the bundled copy produced by `pnpm build`.
2. `../../frontend/dist/client` — the frontend's own build output, used when
   running from source inside the monorepo.

If neither exists the server logs a warning and runs API-only.

## Map proxy — `/api/maptiler/*`

`GET /api/maptiler/<path>` forwards to `https://api.maptiler.com/<path>` and
injects `MAPTILER_KEY` server-side, so the key never reaches the browser.
Client-supplied `key` query params are dropped, and any embedded keys are
stripped from responses.

JSON responses (`style.json`, `tiles.json`, …) get absolute
`https://api.maptiler.com/` URLs rewritten back to this proxy. MapLibre calls
`new URL()` on sprite and glyph URLs, so these must stay absolute — the origin
is rebuilt from `x-forwarded-proto` / `x-forwarded-host` when present, so a
TLS-terminating reverse proxy in front of this HTTP server still yields
`https://` URLs. Binary responses (tiles, glyphs, sprites) stream through
untouched.

## Deployment

The repo-root `Dockerfile` builds this package into a single image (build
context **must** be the repo root — the frontend imports `AppType` from here at
build time, so both manifests are needed). Pushes to `main` publish
`ghcr.io/<owner>/sensor-sim`, and `docker-compose/sensor-sim/compose.yml` runs
it with a named volume mounted at `/app/data/storage`.

Mount a volume at whatever `STORAGE_DIR` points to — otherwise simulations are
lost when the container is replaced.
