# packages/server

Standalone Node.js simulation engine (`@sensor-sim/server`), a single Hono app served over one HTTP server via
`@hono/node-server`. Listens on `PORT` (default `4000`). It also owns the user store (Postgres via Drizzle) and the JWT
auth for the whole system. In production this same process serves the built frontend too (see "Static frontend serving"
below).

The process refuses to start without `DATABASE_URL` and `JWT_SECRET` — `src/db/index.ts`, `src/routes/login.ts` and
`src/middleware/jwtAuth.ts` throw at import time.

## Source layout (`src/`)

- `index.ts` — app bootstrap: creates the simulation service, mounts routes as a flat list (mount order has no
  security consequences — see "Auth" below), sets up CORS, serves the built frontend, starts the combined HTTP+WS
  server, and handles SIGINT/SIGTERM shutdown (stops tick intervals, terminates sockets, closes the pg client).
  Exports `simulationService` (module-level singleton, imported by route handlers) and `HonoEnv` (the shared
  `Variables` type — `jwtPayload`, `sim`, `simStream` — used to type every subapp's `Hono<HonoEnv>()`). There is no
  more `AppType`/typed RPC export; the frontend only imports plain domain types from `types.ts`.
- `zodSchema.ts` — Zod schemas/types for all REST inputs: `simConfigInput` (now includes `shareToken`),
  `simCreateInput` (= config + `id`), `positionInput`, `userInput`/`userUpdate`, `loginInput`.
- `types.ts` — domain types: `Position`, `SimConfig` (adds `ownerId`, `shareToken`), `SimState`, `Simulation`
  (`{ config, state }`), `Status` (`{ startedAt, simListUpdatedAt, numSims }`), `User`/`Profile`, `JWTPayload` and
  `HonoEnv`.
- `simulations.service.ts` — top-level orchestrator. Owns the `Map<id, SimulationRuntime>`, persists `SimConfig`s to
  Postgres via Drizzle (the `sim_configs` table in `db/schema.ts`), reloads all persisted sims via
  `db.query.simConfigs.findMany()` on startup so simulations survive a restart, and exposes `createSim(ownerId,
  input)` / `update` / `updateCurrent` / `remove` / `startSim` / `stopSim` / `list` / `get` / `getSimStream` /
  `status` / `statusStream` / `shutdown`. There is no more sim- *list* stream — `status`/`statusStream` expose only a
  cheap `{startedAt, simListUpdatedAt, numSims}` snapshot that changes on create/remove, for clients to know when to
  refetch the REST list.
- `simulationRuntime.ts` — per-simulation engine (`createSimulationRuntime`). Owns the tick loop (`setInterval`, 100ms)
  that advances `SimState` for `follow` (move toward a target) and `circle` (orbit a center) modes, using
  `util/geoCalc.ts` for geodesic math. Exposes `update`, `updateCurrent`, `updatePlaying`, and a per-sim `simStream`
  (`EventStream<Simulation>`).
- `token.service.ts` — `generateToken(resourceId, ownerId, expiryTimestamp)` / `verifyAndDecode(token)`: a standalone,
  non-JWT signed-token format for simulation sharing (see "Sharing" below). Binary payload (owner id, expiry,
  resource id) HMAC-SHA256-signed with `appSecret()` and base64url-encoded; verified with `timingSafeEqual` plus an
  expiry check. Deliberately separate from `hono/jwt` — it's a capability token for one resource, not a login
  session.
- `db/index.ts` — the Drizzle client (`drizzle(DATABASE_URL, {schema})`, `node-postgres` driver), exported as `db`.
- `db/schema.ts` — Drizzle table definitions. Two tables: `users` (`id` serial PK, `username` text unique, `password`
  text, `admin` boolean) and `sim_configs` (`id` varchar (64) PK, `owner_id` integer FK → `users.id`, `share_token`
  text defaulting to `""`, `target_latitude`/`target_longitude`/`initial_distance`/`initial_azimuth`/`speed` numeric,
  `type` — a `typeEnum` pgEnum of `'follow' | 'circle'` defaulting to `'follow'` — and `playing` boolean defaulting
  to `false`), plus a `usersRelations`/`objectsRelations` pair for the FK.
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
- `util/appSecret.ts` — `appSecret()`: reads and validates `JWT_SECRET`, throwing if unset. Shared by
  `middleware/auth.ts`
  (login/route JWTs) and `token.service.ts` (share tokens) so both use the same secret without duplicating the check.
- `middleware/auth.ts` — exports `jwtMiddleware` (wraps `jwt({secret: appSecret(), alg: "HS256"})`, and additionally
  copies a `?token=` query param into the `Authorization` header first — needed because a `WebSocket` upgrade can't
  set custom headers) and `requireRole(requireAdmin, {checkDb})`: reads `c.get('jwtPayload')`, 401 without one, 403
  when admin is required and missing. `requireRole` assumes `jwtMiddleware` already ran on the same request — always
  mount it after `jwtMiddleware` in a subapp's own `.use()` chain. With `checkDb: true` it re-reads the user from the
  DB instead of trusting the token claim (for fast revocation) — currently unused.
- `middleware/simShareMiddleware.ts` — decodes and verifies a `:token` path param via `token.service.ts`, loads the
  matching simulation, and additionally checks the token still equals that sim's *current* `shareToken` and that the
  decoded owner still matches `ownerId` (so `unshare`/re-share invalidate old links immediately, not just at
  expiry) before setting `sim`/`simStream` in context. Used only by `routes/shared.ts`.
- `util/eventStream.ts` — `createEventStream(getSnapshot)`: a tiny pub/sub used for the status stream and per-sim
  streams; `.collect()` returns an async generator consumed by WebSocket handlers.
- `util/geoCalc.ts` — geodesic helpers: `getPosition` (from origin + distance + azimuth), `getDistance`, `getAzimuth`,
  built on `@turf/turf`.
- `util/randomOffset.ts` — generates a random target near a base point (used for default sim creation).
- `routes/login.ts` — `POST /api/login`, public.
- `routes/users.ts` — user CRUD, mounted at `/api/users`, admin-only.
- `routes/sims.ts` — simulation REST API plus its own per-sim `GET /:id/ws`, and `POST /:id/share`/`unshare`, mounted
  at `/api/sims`, authenticated.
- `routes/shared.ts` — public share-link endpoints (`GET /:token`, `GET /:token/ws`), mounted at `/api/shared`, gated
  by `simShareMiddleware` instead of a JWT.
- `routes/status.ts` — `GET /` and `GET /ws`, mounted at `/api/status`, authenticated; exposes `simulationService`'s
  `status`/`statusStream`.
- `routes/me.ts` — `GET /api/me`, mounted at `/api/me`, authenticated.
- `routes/maptiler.ts` — MapTiler reverse proxy, mounted at `/api/maptiler`, keeps the MapTiler API key server-side,
  authenticated.

## Auth — each subapp declares its own requirement

Each route file that needs auth applies it itself, as the first `.use('*', ...)` in its own chain, instead of relying
on where it's mounted in `src/index.ts`:

```
routes/login.ts, routes/shared.ts                          no .use() at all                        → PUBLIC
routes/maptiler.ts, routes/sims.ts, routes/me.ts,
routes/status.ts                                            .use('*', jwtMiddleware)                → any authenticated user
routes/users.ts                                             .use('*', jwtMiddleware).use('*', requireRole(true)) → admin only
```

`jwtMiddleware` (`jwt({secret: appSecret(), alg: "HS256"})`, plus a `?token=` query-param fallback for WebSocket
upgrades) and `requireRole` both live in `middleware/auth.ts`, so every subapp imports the same instances rather than
re-deriving them. `src/index.ts` mounts all of these as a flat list of `.route()` calls — reordering them no longer
changes any endpoint's access level, only which prefix a handler is reached under. `routes/shared.ts` is public in a
different sense: it has no `jwtMiddleware`, but every path is gated by `simShareMiddleware` checking a per-simulation
share token instead (see "Sharing simulations" below). Two consequences worth knowing:

- `/api/sims/:id/ws` (live simulation data) now needs a bearer token like the rest of `/api/sims`, unlike the old
  public `/ws/sims/:id`. A simulation's owner can share it instead — see below.
- `/api/maptiler` is behind the JWT, so map clients must send the token themselves (the frontend does this through
  MapLibre's `transformRequest`).

`POST /api/login` verifies the password with `verifyPassword` and signs an HS256 token with payload
`{sub: user.id, username, admin, exp}`, valid 24h. `GET /api/me` echoes that payload back. There is no refresh flow and
no server-side session — logout is purely client-side (drop the token).

## Sharing simulations

`sim_configs.owner_id` is set to the creator's user id at `POST /api/sims` time. Ownership itself isn't an ACL —
`GET`/`PUT`/`DELETE` on `/api/sims*` don't check it, so any authenticated user can see or change any sim — it only
gates two endpoints on `routes/sims.ts`:

- `POST /:id/share` — 403 unless `jwtPayload.sub === sim.config.ownerId`. Calls `token.service.ts#generateToken` for
  a 7-day token, writes it to `sim_configs.share_token` via `simulationService.update`, and returns `{token,
  expiryDate}`.
- `POST /:id/unshare` — clears `share_token` back to `""`, which `simShareMiddleware` treats as "not shared" even if
  a previously issued token hasn't expired yet.

`routes/shared.ts` then serves `GET /:token` (a snapshot) and `GET /:token/ws` (the live per-tick stream) with no
JWT at all — `simShareMiddleware` is the only gate, checking the token's HMAC signature and expiry (`token.service.ts`)
plus that it still equals the sim's *current* `share_token` and that the decoded owner id still
matches `ownerId`.

## REST API

All inputs are validated with Zod (`src/zodSchema.ts`). The frontend calls these with a plain `ky` client rather than
a typed RPC client, but still imports the response/body *types* from this package's source, so a schema or column
change here still changes what the frontend expects — just without a compiler catching a moved or renamed route.

### `/api/login` (public)

| Method | Path | Body                     | Notes                                        |
|--------|------|--------------------------|----------------------------------------------|
| POST   | `/`  | `{ username, password }` | `{ token }`, or `401 { error }` on bad creds |

### `/api/sims` (authenticated)

| Method | Path                 | Body             | Notes                                                                                       |
|--------|----------------------|------------------|---------------------------------------------------------------------------------------------|
| GET    | `/`                  | —                | List all `Simulation[]`                                                                     |
| GET    | `/:id`               | —                | Single `Simulation`, 404 if missing                                                         |
| POST   | `/`                  | `simCreateInput` | `id` required; everything else defaulted. `ownerId` set from the token. Returns the new sim |
| PUT    | `/:id`               | `simConfigInput` | Partial config update (target, type, speed, `shareToken`, …)                                |
| DELETE | `/:id`               | —                | Remove sim + persisted config                                                               |
| PUT    | `/:id/updateCurrent` | `positionInput`  | Teleport current position, recompute config from it                                         |
| PUT    | `/:id/start`         | —                | Resume a stopped sim                                                                        |
| PUT    | `/:id/stop`          | —                | Pause a sim (keeps config, clears state)                                                    |
| GET    | `/:id/ws`            | — (WS upgrade)   | Streams that `Simulation` per tick; see WebSocket API below                                 |
| POST   | `/:id/share`         | —                | Owner only. Mints a 7-day share token, returns `{token, expiryDate}`                        |
| POST   | `/:id/unshare`       | —                | Clears the share token                                                                      |

Mutating routes answer `{success: true}` and 404 `{error}` for unknown ids. There is no separate `updateTarget`
endpoint any more — move the target with `PUT /:id`.

### `/api/status` (authenticated)

| Method | Path  | Body | Notes                                                            |
|--------|-------|------|------------------------------------------------------------------|
| GET    | `/`   | —    | `Status` — `{startedAt, simListUpdatedAt, numSims}`              |
| GET    | `/ws` | —    | Streams `Status` on every create/remove; see WebSocket API below |

Not sim data itself — a cheap signal telling a client (that holds its own REST-fetched sim list) when to refetch it.

### `/api/me` (authenticated)

`GET /api/me` → `{ id, username, admin, exp }` straight from the token payload (no DB read).

### `/api/users` (admin only)

| Method | Path   | Body                  | Notes                                                      |
|--------|--------|-----------------------|------------------------------------------------------------|
| GET    | `/`    | —                     | All users, ordered by id, without `password`               |
| GET    | `/:id` | —                     | Single user, 404 if missing                                |
| POST   | `/`    | `userInput`           | Password is hashed before insert; returns the created user |
| PUT    | `/:id` | `userInput.partial()` | Only hashes `password` when present                        |
| DELETE | `/:id` | —                     | `{message: 'User deleted'}`                                |

## WebSocket API

| Path                    | Mounted in         | Payload      | Auth                                        | Update trigger                           |
|-------------------------|--------------------|--------------|---------------------------------------------|------------------------------------------|
| `/api/sims/:id/ws`      | `routes/sims.ts`   | `Simulation` | bearer token (header or `?token=`)          | Every position tick while that sim plays |
| `/api/shared/:token/ws` | `routes/shared.ts` | `Simulation` | valid, unexpired, still-current share token | Same, for a shared sim                   |
| `/api/status/ws`        | `routes/status.ts` | `Status`     | bearer token (header or `?token=`)          | Any simulation created or removed        |

There is no more list-broadcast socket (the old `/ws/sims`, `Simulation[]`) — `GET /api/sims` is a plain REST fetch
now, and `/api/status/ws` only signals *that* the list changed, not what changed, so a client refetches on demand.
Each per-sim/status connection consumes an async-generator stream (`EventStream.collect()`) and immediately starts
receiving snapshots on open; no request/response — it's push-only. Connecting to an unknown sim id returns 404, and
an invalid/expired/stale share token returns 400/403, before the upgrade.

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
`key` query param. Requests need a bearer token — `maptiler.ts` applies `jwtMiddleware` itself, like any other
authenticated route file.

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
