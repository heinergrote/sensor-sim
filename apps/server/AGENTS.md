# apps/server

Standalone Node.js simulation engine (`@sensor-sim/server`). Runs three independent servers:

| Server   | Default port | Env var   | Notes                         |
|----------|-------------|-----------|-------------------------------|
| tRPC     | 4000        | `PORT`    | HTTP queries + WS subscriptions |
| Raw WS   | 4001        | `WSPORT`  | Streams `SimState` JSON       |
| REST     | 4002        | `RESTPORT`| Hono, health + sim read endpoints |

## tRPC procedures (`src/trcp/appRouter.ts`)

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

Connect with `ws://host:4001?id=<simId>`. Sends `SimState` JSON on connect and on every update.

## REST endpoints (`src/rest/restServer.ts`)

```
GET /api/health        → { status, uptime }
GET /api/sims          → SimState[]
GET /api/sims/:id      → SimState
```

## Dev & build

```bash
pnpm dev     # tsx watch (hot reload)
pnpm build   # tsc → dist/
pnpm start   # node dist/index.js
```
