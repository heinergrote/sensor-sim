# @sensor-sim/server

A single Node.js process that stores simulation configs, runs the simulations derived from them, streams their
positions over WebSockets, manages users and JWTs, proxies map tiles, and — in production — serves the frontend
from the same origin.

## Quick start

Needs a reachable Postgres. Create `.env` here:

```dotenv
DATABASE_URL=postgres://user:password@localhost:5432/sensorsim
JWT_SECRET=some-long-random-string
DEFAULT_ADMIN_PASSWORD=choose-one
MAPTILER_KEY=your-maptiler-key
```

```bash
pnpm migrate:dev  # apply migrations + seed admin (the server never migrates itself)
pnpm dev          # tsx watch, http://localhost:4000
pnpm typecheck
pnpm build        # frontend build → typecheck → tsdown → dist/ (frontend copied to dist/public)
pnpm start        # node dist/index.js
```

A built `dist/` is self-contained (server + frontend). `http/users.http` has ready-made login/user requests.

## Environment variables

| Variable                 | Default      | Purpose                                         |
|--------------------------|--------------|-------------------------------------------------|
| `DATABASE_URL`           | — (required) | Postgres connection string                      |
| `JWT_SECRET`             | — (required) | HS256 secret for login tokens                   |
| `DEFAULT_ADMIN_USERNAME` | `admin`      | Admin created by the migrate step               |
| `DEFAULT_ADMIN_PASSWORD` | —            | Its password; without it nothing is seeded      |
| `MAPTILER_KEY`           | —            | Required for `/api/maptiler` (500 without it)   |
| `PORT`                   | `4000`       | HTTP port for REST, WebSockets and static files |
| `NODE_ENV`               | —            | Only logged; CORS is open for all origins       |

## Architecture

```
src/index.ts       bootstrap, mounts subapps, serves frontend, graceful shutdown
src/db/            Drizzle schema (row types), client, migrate + admin seed
src/simconfigs/    /api/configs — persisted sim configs (api, repository, mapping)
src/simulation/    SimulationEngine (id → runner), SimulationRunner (100 ms tick), per-type definitions
src/sims/          /api/sims (read-only)
src/users/         /api/users — admin CRUD (api, repository, mappings)
src/login/ me/ maptiler/ status/ shared/   remaining subapps
src/middleware/    jwtAuth, requireRole, withOwnSim, simShareMiddleware
src/util/          eventStream, passwords, appSecret (`jwtSecret()`)
```

**Config vs. runtime.** A sim config is the durable row in `sim_configs`; the engine keeps one in-memory runner
per config **that has a valid spec**. Each config mutation re-syncs the engine from the database: new configs get
a runner, runners of deleted or spec-less configs are disposed, and any `spec`/`playing` change restarts a runner
from its spec.

**Specs.** What a sim does is a JSON `spec` (jsonb column, nullable), discriminated by `type`:

| `type`  | Fields                                                                  | Behaviour                         |
|---------|-------------------------------------------------------------------------|-----------------------------------|
| `fixed` | `latitude, longitude`                                                   | stays put                         |
| `path`  | `startLatitude, startLongitude, targetLatitude, targetLongitude, speed` | moves start → target, stops there |
| `orbit` | `centerLatitude, centerLongitude, radius, startAngle, speed`            | circles the center                |

Distances in m, angles in °, speed in m/s; movement is geodesic (`@turf/turf`). Each type is a
`SimulationDefinition` (default spec, anchor location, `init`, pure `step`) registered in
`src/simulation/simulationDefinitions.ts`.

**Layered types.** Repositories speak Drizzle row types; handlers validate input with Zod and return DTOs built by
each module's `toDto` mapping (which e.g. strips password hashes). Only DTOs are exported to the frontend.

## Auth

`POST /api/login` returns a 24 h HS256 token (`{sub, username, admin, exp}`). Send it as `Authorization: Bearer …`,
or as `?token=` on WebSocket routes. No refresh, no server sessions.

| Scope              | Routes                                                                              |
|--------------------|-------------------------------------------------------------------------------------|
| public             | `POST /api/login`, `/api/shared/:token[/ws]`, static files                          |
| any logged-in user | `/api/me`, `/api/status`, `/api/maptiler`, `GET/POST /api/configs`, `GET /api/sims` |
| owner only         | `/api/configs/:id*`, `/api/sims/:id*` (404 unknown, 403 non-owner)                  |
| admin only         | `/api/users`                                                                        |

Each subapp applies its own middleware; mount order in `index.ts` is irrelevant for access.

## REST API

### `/api/configs` — sim configs (owner-scoped)

| Method | Path           | Body              | Result                                                                                                                                                                      |
|--------|----------------|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| GET    | `/`            | —                 | Caller's `SimConfigDto[]`                                                                                                                                                   |
| GET    | `/:id`         | —                 | `SimConfig`                                                                                                                                                                 |
| POST   | `/`            | `CreateSimConfig` | Created config. All fields optional — defaults: `spec: null`, playing, label `sim-<n>`                                                                                       |
| PATCH  | `/:id`         | `UpdateSimConfig` | Updated config (any subset of `label`, `spec` — full object or `null`, `playing`)                                                                                            |
| PUT    | `/:id/type`    | `{type}`          | Replaces the spec with randomized defaults of that type, anchored at the old spec's location (else near Braunschweig); no-op if unchanged                                    |
| DELETE | `/:id`         | —                 | Deleted config                                                                                                                                                              |
| PUT    | `/:id/start`   | —                 | Sets `playing: true` → `{success: true}`                                                                                                                                    |
| PUT    | `/:id/stop`    | —                 | Sets `playing: false` → `{success: true}`                                                                                                                                   |
| POST   | `/:id/share`   | —                 | Mints share token (`<id>!<nanoid10>`, no expiry) → `{token}`                                                                                                                |
| POST   | `/:id/unshare` | —                 | Clears the token → `{success: true}`                                                                                                                                        |

`SimConfig`: `{id, ownerId, label, shareToken, spec: Spec | null, playing}`. `id` is a serial int; `shareToken` is
`""` when not shared. A stored spec that fails validation is returned as `null`.

### `/api/sims` — running simulations (read-only)

| Method | Path      | Result                                          |
|--------|-----------|-------------------------------------------------|
| GET    | `/`       | Caller's `SimData[]` (sims with a spec only)    |
| GET    | `/:id`    | `SimData` — `{position: {latitude, longitude}}` |
| GET    | `/:id/ws` | WebSocket, streams `SimData` every tick         |

### Others

- `GET /api/me` → `{id, username, admin}` from the token (no DB hit).
- `GET /api/status` → the caller's current `StatusMessage`: `{type: "configUpdate", revision}` or `{type: "ping"}`.
  `GET /api/configs` sends the matching `X-Config-Revision` header, so clients can skip refetches they don't need.
- `/api/users` (admin): `GET /`, `GET /:id`, `POST /` `{username, password, admin}`, `PUT /:id` (same body; password
  re-hashed), `DELETE /:id`. Passwords are scrypt-hashed (`salt:hash`).

## WebSocket API

| Path                    | Payload         | Auth                           | Emitted                                           |
|-------------------------|-----------------|--------------------------------|---------------------------------------------------|
| `/api/sims/:id/ws`      | `SimData`       | bearer / `?token=`, owner only | on connect, then every tick while playing         |
| `/api/shared/:token/ws` | `SimData`       | valid share token in the path  | same                                              |
| `/api/status/ws`        | `StatusMessage` | bearer / `?token=`             | on connect, then ≤ every 200 ms on own config changes |

All sockets are push-only. The status socket is a "refetch configs" signal, not data. Deleting a config closes
every open socket for that simulation from the server side.

## Sharing

The share token is **not** a JWT but an unguessable `<sim id>!<nanoid10>` with no expiry, matched exactly against
`sim_configs.share_token` on every request — `unshare` revokes immediately. Also served under `/s/:token[/ws]`.

## Database & migrations

Drizzle (`node-postgres`), schema in `src/db/schema.ts`, SQL in `drizzle/`, config `drizzle.config.ts`.

```bash
pnpm db:generate  # schema change → new migration file
pnpm migrate:dev  # apply + seed admin (what the image runs, via dist/migrate.js)
pnpm db:migrate   # drizzle-kit: migrations only, no seed
pnpm db:push      # dev only
pnpm db:studio
```

Tables: `users`, `sim_configs` (+ sequence `sim_config_label_seq`). **Migration `0007` deletes all sim configs**
(id changed from text to serial; the old text id became `label`). **Migrations `0008`/`0009` drop the old
`type`/`speed`/target/initial columns** in favour of `spec` — existing configs survive with `spec: null`.

## Serving the frontend & map proxy

Unmatched GETs fall back to `index.html` from `dist/public`, else `../../frontend/dist/client`; if neither exists
the server runs API-only. `GET /api/maptiler/<path>` proxies `api.maptiler.com`, injects `MAPTILER_KEY`, drops
client `key` params, and rewrites absolute MapTiler URLs in JSON to the proxy (honouring `x-forwarded-*`).

## Deployment

Repo-root `Dockerfile` (**context must be the repo root**). `publish.yml` pushes `ghcr.io/<owner>/sensor-sim` on
releases (`1.2.3`, `1.2`, `latest`, `sha-<short>`) and POSTs `?SENSOR_SIM_VERSION=…` to `PORTAINER_WEBHOOK_URL`.
`compose.yaml` pins that version: `db` (healthy) → `migrate` (`node dist/migrate.js`, must exit 0) → `server`.

- `DATABASE_URL` is assembled from `POSTGRES_*` in `.env` (host `db`); keep the password URL-safe.
- Migrations are forward-only — bump the pinned tag deliberately. `depends_on` gates don't hold on Swarm.
- `db` volume mounts at `/var/lib/postgresql` (Postgres 18+ layout); `drizzle/` ships in the image.
