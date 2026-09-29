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
pnpm build        # frontend build → typecheck → tsup → dist/ (frontend copied to dist/public)
pnpm start        # node dist/index.js
```

A built `dist/` is self-contained (server + frontend). `http/users.http` has ready-made login/user requests.

## Environment variables

| Variable                 | Default      | Purpose                                                 |
|--------------------------|--------------|---------------------------------------------------------|
| `DATABASE_URL`           | — (required) | Postgres connection string                              |
| `JWT_SECRET`             | — (required) | HS256 secret for login tokens; also signs share tokens  |
| `DEFAULT_ADMIN_USERNAME` | `admin`      | Admin created by the migrate step                       |
| `DEFAULT_ADMIN_PASSWORD` | —            | Its password; without it nothing is seeded              |
| `MAPTILER_KEY`           | —            | Required for `/api/maptiler` (500 without it)           |
| `PORT`                   | `4000`       | HTTP port for REST, WebSockets and static files         |
| `NODE_ENV`               | —            | Only logged; CORS is open for all origins               |

## Architecture

```
src/index.ts       bootstrap, mounts subapps, serves frontend, graceful shutdown
src/db/            Drizzle schema (row types), client, migrate + admin seed
src/simconfigs/    /api/configs — persisted sim configs (api, repository, mappings)
src/simengine/     SimulationEngine (id → runner) + SimulationRunner (100 ms tick) + /api/sims (read-only)
src/users/         /api/users — admin CRUD (api, repository, mappings)
src/login/ me/ maptiler/ status/ shared/   remaining subapps
src/middleware/    jwtAuth, requireRole, withOwnSim, simShareMiddleware
src/util/          shareTokens, eventStream, passwords, appSecret
```

**Config vs. runtime.** A sim config is the durable row in `sim_configs`; the engine keeps one in-memory runner
per config. Each config mutation re-syncs the engine from the database: new configs get a runner, runners of
deleted configs are disposed, existing runners apply the change (`type`/`speed` live, anything else restarts from the config's initial position). Movement is
geodesic (`@turf/turf`): `follow` moves toward the target and stops there, `circle` orbits it.

**Layered types.** Repositories speak Drizzle row types; handlers validate input with Zod and return DTOs built by
each module's `toDto` mapping (which e.g. strips password hashes). Only DTOs are exported to the frontend.

## Auth

`POST /api/login` returns a 24 h HS256 token (`{sub, username, admin, exp}`). Send it as `Authorization: Bearer …`,
or as `?token=` on WebSocket routes. No refresh, no server sessions.

| Scope              | Routes                                                                    |
|--------------------|---------------------------------------------------------------------------|
| public             | `POST /api/login`, `/api/shared/:token[/ws]`, static files                |
| any logged-in user | `/api/me`, `/api/status`, `/api/maptiler`, `GET/POST /api/configs`, `GET /api/sims` |
| owner only         | `/api/configs/:id*`, `/api/sims/:id*` (404 unknown, 403 non-owner)        |
| admin only         | `/api/users`                                                              |

Each subapp applies its own middleware; mount order in `index.ts` is irrelevant for access.

## REST API

### `/api/configs` — sim configs (owner-scoped)

| Method | Path           | Body                     | Result                                                   |
|--------|----------------|--------------------------|----------------------------------------------------------|
| GET    | `/`            | —                        | Caller's `SimConfigDto[]`                                |
| GET    | `/:id`         | —                        | `SimConfigDto`                                           |
| POST   | `/`            | `CreateSimConfigDto`     | Created config. All fields optional — defaults: target random within 500 m of central Braunschweig, `follow`, random 50–200 m / 0–360° / 5–20 m/s, playing, label `sim-<n>` |
| PATCH  | `/:id`         | `UpdateSimConfigDto`     | Updated config (any subset of label, type, target, initial distance/azimuth, speed, playing) |
| DELETE | `/:id`         | —                        | Deleted config                                           |
| PUT    | `/:id/start`   | —                        | Sets `playing: true` → `{success: true}`                 |
| PUT    | `/:id/stop`    | —                        | Sets `playing: false` → `{success: true}`                |
| POST   | `/:id/share`   | —                        | 7-day share token → `{token, expiryDate}`                |
| POST   | `/:id/unshare` | —                        | Clears the token → `{success: true}`                     |

`SimConfigDto`: `{id, ownerId, label, shareToken, type, targetLatitude, targetLongitude, initialDistance,
initialAzimuth, speed, playing}`. `id` is a serial int; `shareToken` is `""` when not shared.

### `/api/sims` — running simulations (read-only)

| Method | Path      | Result                                        |
|--------|-----------|-----------------------------------------------|
| GET    | `/`       | Caller's `SimState[]`                         |
| GET    | `/:id`    | `SimState` — `{id, start, current, distance, azimuth}` |
| GET    | `/:id/ws` | WebSocket, streams `SimState` every tick      |

### Others

- `GET /api/me` → `{id, username, admin}` from the token (no DB hit).
- `GET /api/status` → current `StatusMessage`: `{type: "configUpdate", updatedAt}` or `{type: "ping"}`.
- `/api/users` (admin): `GET /`, `GET /:id`, `POST /` `{username, password, admin}`, `PUT /:id` (same body; password
  re-hashed), `DELETE /:id`. Passwords are scrypt-hashed (`salt:hash`).

## WebSocket API

| Path                    | Payload         | Auth                             | Emitted                                   |
|-------------------------|-----------------|----------------------------------|-------------------------------------------|
| `/api/sims/:id/ws`      | `SimState`      | bearer / `?token=`, owner only   | on connect, then every tick while playing |
| `/api/shared/:token/ws` | `SimState`      | valid share token in the path    | same                                      |
| `/api/status/ws`        | `StatusMessage` | bearer / `?token=`               | on connect, then ≤ every 500 ms on config changes |

All sockets are push-only. The status socket is a "refetch configs" signal, not data. Deleting a config closes
every open socket for that simulation from the server side.

## Sharing

The share token is **not** a JWT: `util/shareTokens.ts` packs sim id + owner id + expiry and signs it with a
truncated HMAC-SHA256 (base64url). `simShareMiddleware` checks signature, expiry, and that it still matches the
sim's stored `shareToken` and owner — so `unshare` revokes immediately.

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
(id changed from text to serial; the old text id became `label`).

## Serving the frontend & map proxy

Unmatched GETs fall back to `index.html` from `dist/public`, else `../../frontend/dist/client`; if neither exists
the server runs API-only. `GET /api/maptiler/<path>` proxies `api.maptiler.com`, injects `MAPTILER_KEY`, drops
client `key` params, and rewrites absolute MapTiler URLs in JSON to the proxy (honouring `x-forwarded-*`).

## Deployment

Built from the repo-root `Dockerfile` (**context must be the repo root**). `.github/workflows/publish.yml` publishes
`ghcr.io/<owner>/sensor-sim` on releases (`1.2.3`, `1.2`, `latest`, `sha-<short>`) and POSTs the version to the
Portainer stack webhook (`PORTAINER_WEBHOOK_URL` secret) as `?SENSOR_SIM_VERSION=…`.

`compose.yaml` pins that version and starts `db` (healthy) → `migrate` (same image, `node dist/migrate.js`,
`restart: "no"`, must exit 0) → `server`. A failed migration means a failed deploy, not a crash loop. Notes:

- `DATABASE_URL` is assembled from `POSTGRES_*` in `.env` and points at host `db`; keep the password URL-safe.
- Migrations are forward-only; a rolled-back image runs silently against a newer schema — bump the pinned tag
  deliberately.
- `depends_on` gates only hold on standalone Docker, not Swarm.
- The `db` volume mounts at `/var/lib/postgresql` (Postgres 18+ layout). The app container needs no volume.
- `drizzle/` ships in the image (`package.json#files`), so a committed migration is applied on the next deploy.
