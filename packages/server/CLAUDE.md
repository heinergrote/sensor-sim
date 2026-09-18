# packages/server

Standalone Node.js simulation engine (`@sensor-sim/server`), a single Hono app served over one HTTP server via
`@hono/node-server`. Listens on `PORT` (default `4000`). It also owns the user store (Postgres via Drizzle) and the JWT
auth for the whole system. In production this same process serves the built frontend too (see "Static frontend serving"
below).

The process refuses to start without `DATABASE_URL` and `JWT_SECRET` — `src/db/index.ts` and `src/routes/login.ts`
throw at import time.

## Source layout (`src/`)

- `index.ts` — app bootstrap: creates the simulation service, mounts routes
  **in authorization order** (see below), sets up CORS, serves the built frontend, starts the combined HTTP+WS server,
  and handles SIGINT/SIGTERM shutdown (stops tick intervals, terminates sockets, closes the pg client). Exports
  `simulationService` (module-level singleton, imported by route handlers) and `AppType` (the Hono route tree, used by
  the frontend's `hc<AppType>` typed client).
- `zodSchema.ts` — Zod schemas/types for all REST inputs: `simConfigInput`, `simCreateInput` (= config + `id`),
  `positionInput`, `userInput`/`userUpdate`, `loginInput`.
- `types.ts` — domain types: `Position`, `SimConfig`, `SimState`, `Simulation` (`{ config, state }`), `User`
  (`typeof users.$inferSelect`, so it follows the Drizzle schema) and `JwtPayload`.
- `simulations.service.ts` — top-level orchestrator. Owns the `Map<id, SimulationRuntime>`, persists `SimConfig`s to
  Postgres via Drizzle (the `sim_configs` table in `db/schema.ts`), reloads all persisted sims via
  `db.query.simConfigs.findMany()` on startup so simulations survive a restart, and exposes `create` / `update` /
  `updateCurrent` / `remove` / `startSim` / `stopSim` / `list` / `get` / `getSimStream` / `simListStream` / `shutdown`.
  Also runs a 100ms interval that re-emits the sim list (keeps clients' snapshots fresh even without config changes).
- `simulationRuntime.ts` — per-simulation engine (`createSimulationRuntime`). Owns the tick loop (`setInterval`, 100ms)
  that advances `SimState` for `follow` (move toward a target) and `circle` (orbit a center) modes, using
  `util/geoCalc.ts` for geodesic math. Exposes `update`, `updateCurrent`, `start`, `stop`, and a per-sim `simStream`
  (`EventStream<Simulation>`).
- `db/index.ts` — the Drizzle client (`drizzle(DATABASE_URL, {schema})`, `node-postgres` driver), exported as `db`.
- `db/schema.ts` — Drizzle table definitions. Two tables now: `users` (`id` serial PK, `username` text unique,
  `password` text, `admin` boolean) and `sim_configs` (`id` varchar(64) PK, `target_latitude`/`target_longitude`/
  `initial_distance`/`initial_azimuth`/`speed` numeric, `type` — a `typeEnum` pgEnum of `'follow' | 'circle'`
  defaulting to `'follow'` — and `playing` boolean defaulting to `false`).
- `migrate.ts` — **second build entrypoint** (`dist/migrate.js`), not imported by the server. Calls `dbInit()`, closes
  the pg client and exits 0/1. This is the only thing that migrates: `index.ts` does not. `tsup.config.ts` lists it
  alongside `src/index.ts`, and the `build` script must invoke plain `tsup` — a CLI positional (`tsup src/index.ts`)
  silently overrides the config's entry list and drops this file from `dist/`.
- `db/dbInit.ts` — applies pending migrations from `<cwd>/drizzle` (resolved from `process.cwd()` so it works in dev and
  in Docker), then seeds a default admin from `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` if that user doesn't
  exist. No password set → warn and skip. Invoked only from `migrate.ts`.
- `user.service.ts` — Drizzle queries for users. Note `allowedColumns`: every exported read/write projects the `users`
  columns **minus `password`**, so hashes never leave this module. The one exception is
  `getUserWithSecretsByName(username)`, used by the login route.
- `util/passwords.ts` — `hashPassword` / `verifyPassword` using node `scrypt`; stored format is `"<saltHex>:<hashHex>"`,
  compared with `timingSafeEqual`.
- `middleware/auth.ts` — `verifyAuth(requireAdmin, {checkDb})`: reads `c.get('jwtPayload')`, 401 without one, 403 when
  admin is required and missing. With `checkDb: true` it re-reads the user from the DB instead of trusting the token
  claim (for fast revocation) — currently unused.
- `util/eventStream.ts` — `createEventStream(getSnapshot)`: a tiny pub/sub used for both the sim-list stream and per-sim
  streams; `.collect()` returns an async generator consumed by WebSocket handlers.
- `util/geoCalc.ts` — geodesic helpers: `getPosition` (from origin + distance + azimuth), `getDistance`, `getAzimuth`,
  built on `@turf/turf`.
- `util/randomOffset.ts` — generates a random target near a base point (used for default sim creation).
- `routes/login.ts` — `POST /api/login`, public.
- `routes/users.ts` — user CRUD, mounted at `/api/users`, admin-only.
- `routes/sims.ts` — simulation REST API, mounted at `/api/sims`.
- `routes/simsWebsocket.ts` — raw WebSocket API, mounted at `/ws/sims`, public.
- `routes/maptiler.ts` — MapTiler reverse proxy, mounted at `/api/maptiler`, keeps the MapTiler API key server-side.

## Auth — mount order is the policy

Hono applies `.use()` only to routes registered after it, so the order inside `src/index.ts` decides access:

```
cors('*')                                   → all routes
route /api/login, /ws/sims                  → PUBLIC
use   /api/*  jwt({secret, alg: "HS256"})
route /api/maptiler, /api/sims, get /api/me → any authenticated user
use   /api/*  verifyAuth(true)
route /api/users                            → admin only
```

Moving a `.route()` across one of those `.use()` lines silently changes its access level — the main thing to watch when
adding endpoints. Two consequences worth knowing:

- `/ws/sims` is **unauthenticated**: live simulation data is readable by anyone who can reach the port.
- `/api/maptiler` is behind the JWT, so map clients must send the token themselves (the frontend does this through
  MapLibre's `transformRequest`).

`POST /api/login` verifies the password with `verifyPassword` and signs an HS256 token with payload
`{sub: user.id, username, admin, exp}`, valid 24h. `GET /api/me` echoes that payload back. There is no refresh flow and
no server-side session — logout is purely client-side (drop the token).

## REST API

All inputs are validated with Zod (`src/zodSchema.ts`). The frontend consumes these via a typed Hono client
(`hc<AppType>`), so route/schema changes here directly affect frontend types.

### `/api/login` (public)

| Method | Path | Body                     | Notes                                          |
|--------|------|--------------------------|------------------------------------------------|
| POST   | `/`  | `{ username, password }` | `{ token }`, or `401 { error }` on bad creds   |

### `/api/sims` (authenticated)

| Method | Path                 | Body               | Notes                                                        |
|--------|----------------------|--------------------|---------------------------------------------------------------|
| GET    | `/`                  | —                  | List all `Simulation[]`                                       |
| GET    | `/:id`               | —                  | Single `Simulation`, 404 if missing                           |
| POST   | `/`                  | `simCreateInput`   | `id` required; everything else defaulted. Returns the new sim |
| PUT    | `/:id`               | `simConfigInput`   | Partial config update (target, type, speed, …)                |
| DELETE | `/:id`               | —                  | Remove sim + persisted config                                 |
| PUT    | `/:id/updateCurrent` | `positionInput`    | Teleport current position, recompute config from it           |
| PUT    | `/:id/start`         | —                  | Resume a stopped sim                                          |
| PUT    | `/:id/stop`          | —                  | Pause a sim (keeps config, clears state)                      |

Mutating routes answer `{success: true}` and 404 `{error}` for unknown ids. There is no separate `updateTarget`
endpoint any more — move the target with `PUT /:id`.

### `/api/me` (authenticated)

`GET /api/me` → `{ id, username, admin, exp }` straight from the token payload (no DB read).

### `/api/users` (admin only)

| Method | Path   | Body                 | Notes                                                             |
|--------|--------|----------------------|--------------------------------------------------------------------|
| GET    | `/`    | —                    | All users, ordered by id, without `password`                       |
| GET    | `/:id` | —                    | Single user, 404 if missing                                        |
| POST   | `/`    | `userInput`          | Password is hashed before insert; returns the created user         |
| PUT    | `/:id` | `userInput.partial()`| Only hashes `password` when present                                |
| DELETE | `/:id` | —                    | `{message: 'User deleted'}`                                        |

## WebSocket API (`src/routes/simsWebsocket.ts`, mounted at `/ws/sims`)

| Path           | Payload        | Update trigger                                          |
|----------------|----------------|---------------------------------------------------------|
| `/ws/sims`     | `Simulation[]` | Any config/state change, plus a 100ms heartbeat re-emit |
| `/ws/sims/:id` | `Simulation`   | Every position tick (100ms) while that sim is playing   |

Each connection consumes an async-generator stream (`EventStream.collect()`) and immediately starts receiving snapshots
on open; no request/response — it's push-only. Connecting to an unknown sim id returns 404 before the upgrade.

## Database & migrations

Drizzle Kit is configured in `drizzle.config.ts` (schema `./src/db/schema.ts`, output `./drizzle`, dialect
`postgresql`, credentials from `DATABASE_URL`).

```bash
pnpm db:generate  # schema change → new SQL migration in drizzle/
pnpm migrate:dev  # tsx src/migrate.ts — migrations + admin seed; what the image runs
pnpm migrate      # node dist/migrate.js — same, but needs a build first
pnpm db:migrate   # drizzle-kit: migrations only, NO admin seed
pnpm db:push      # push schema straight to the DB (dev shortcut, skips migration files)
pnpm db:studio    # browse the DB
```

**The server never migrates.** Nothing applies a migration as a side effect of starting the app, in dev or in
production — run one of the migrate scripts yourself. On a fresh database prefer `migrate:dev`: `db:migrate` applies
the schema but skips the admin seed, leaving you with no account to log in with.

Workflow for a schema change: edit `src/db/schema.ts` → `pnpm db:generate` → commit the generated file in `drizzle/`
→ `pnpm migrate:dev` → restart the server. Because `types.ts` derives `User` from the schema, a column change
propagates to the frontend's types immediately.

## Static frontend serving (`src/index.ts`)

The server can serve the built frontend from the same origin/process, checked in this order:

1. `dist/public` — copied in by `scripts/copy-frontend.mjs` during `pnpm build`, making a built `dist/` a self-contained
   deployable artifact.
2. `../../frontend/dist/client` — the frontend package's own build output, used when running from source in the
   monorepo.

If found, all unmatched GET requests fall back to `index.html` (SPA routing support for Solid Router deep links).

## Map proxy (`src/routes/maptiler.ts`)

`GET /api/maptiler/:path` forwards to `https://api.maptiler.com/:path`, injecting `MAPTILER_KEY` server-side, rewriting
absolute MapTiler URLs in JSON responses (style.json, tiles.json) back to this proxy, and stripping any client-supplied
`key` query param. Requests need a bearer token like any other `/api/*` route.

## Env vars

- `PORT` — HTTP port (default `4000`)
- `NODE_ENV` — currently only logged; CORS is enabled for all origins regardless
- `MAPTILER_KEY` — required for the map proxy to function
- `DATABASE_URL` — **required**, Postgres connection string for Drizzle
- `JWT_SECRET` — **required**, HS256 signing secret
- `DEFAULT_ADMIN_USERNAME` — default `admin`, seeded by the migrate entrypoint
- `DEFAULT_ADMIN_PASSWORD` — no default; without it no admin is seeded (`db:migrate` never seeds either way)

`.env` is loaded via `dotenv/config`.

## Dev & build

```bash
pnpm migrate:dev # apply migrations + seed admin (run this before the first dev start)
pnpm dev         # tsx watch src/index.ts (hot reload)
pnpm typecheck   # tsc --noEmit
pnpm build       # builds frontend, typechecks, tsup → dist/ (both entrypoints), copies frontend into dist/public
pnpm start       # node dist/index.js
```

`http/users.http` holds ready-made requests for the user/login endpoints (it stores the login token in
`auth_token` for the following calls).
