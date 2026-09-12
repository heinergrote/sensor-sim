# apps/server

Standalone Node.js simulation engine (`@sensor-sim/server`). Runs three independent servers:

| Server | Default port | Env var     | Notes                               |
|--------|--------------|-------------|-------------------------------------|
| tRPC   | 4000         | `TRCP_PORT` | HTTP queries + subscriptions        |
| Raw WS | 4001         | `WS_PORT`   | Streams `SimState` JSON             |
| REST   | 4002         | `REST_PORT` | Hono, sim read endpoints, map proxy |

## tRPC procedures (`src/trcp/schema.ts`)

**Queries**

- `listSims` — list all simulation IDs
- `simState({ id })` — current state of one simulation

**Mutations**

- `createSim({ id, type, speed })` — create a simulation (`type`: `follow` | `circle`)
- `deleteSim({ id })`
- `setTarget({ id, latitude, longitude })` — move toward a target (follow mode)
- `setCurrent({ id, latitude, longitude })` — teleport current position
- `setType({ id, type })`
- `setSpeed({ id, speed })`

**Subscriptions**

- `onSimListChange` — fires when simulations are added/removed
- `onSimStateChange({ id })` — fires on every position update

## Raw WebSocket (`src/ws/wsServer.ts`)

Resource-oriented paths, mirroring the REST API:

| Path                         | Payload        | Update trigger                                        |
|------------------------------|----------------|-------------------------------------------------------|
| `ws://host:4001/ws/sims`     | `Simulation[]` | Configuration changes only (create / update / delete) |
| `ws://host:4001/ws/sims/:id` | `Simulation`   | Every position tick                                   |

Each connection immediately receives the current snapshot, then subsequent pushes on change.

## REST endpoints (`src/routes`)

```
GET /api/sims          → SimState[]
GET /api/sims/:id      → SimState
GET /api/maptiler/...  → MapTile proxy
```

## Dev & build

```bash
pnpm dev     # tsx watch (hot reload)
pnpm build   # tsc → dist/
pnpm start   # node dist/index.js
```
