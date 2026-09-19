# @sensor-sim/server

The sensor-sim simulation engine: a single Node.js process that runs GPS
simulations, broadcasts their positions over WebSockets, exposes a REST API to
control them, manages user accounts and their JWTs, proxies map tiles, and —
in production — serves the management frontend from the same origin.

## Quick start

You need a reachable Postgres and a few environment variables; the process
exits on startup without `DATABASE_URL` or `JWT_SECRET`. Create a `.env` here:

```dotenv
DATABASE_URL=postgres://user:password@localhost:5432/sensorsim
JWT_SECRET=some-long-random-string
DEFAULT_ADMIN_PASSWORD=choose-one
MAPTILER_KEY=your-maptiler-key
```

Then, from the repo root (`pnpm dev` starts this and the frontend together), or
here:

```bash
pnpm dev        # tsx watch src/index.ts, hot reload, http://localhost:4000
pnpm typecheck  # tsc --noEmit
pnpm build      # frontend build → typecheck → tsup → dist/, frontend copied into dist/public
pnpm start      # node dist/index.js
```

The server itself never migrates the database — run `pnpm migrate:dev` first
(schema + admin seed) against a fresh database; see "Database & migrations"
below.

`pnpm build` deliberately builds `@sensor-sim/frontend` first and copies its
static output into `dist/public` (see `scripts/copy-frontend.mjs`), so a built
`dist/` is a **self-contained server + frontend artifact** that needs no
sibling packages at runtime.

`http/users.http` contains ready-made requests for the login and user
endpoints; the login request stores its token for the calls below it.

## Environment variables

| Variable                 | Default          | Purpose                                                          |
|--------------------------|------------------|------------------------------------------------------------------|
| `DATABASE_URL`           | — (required)     | Postgres connection string used by Drizzle                       |
| `JWT_SECRET`             | — (required)     | HS256 secret the login tokens are signed with                    |
| `DEFAULT_ADMIN_USERNAME` | `admin`          | Admin account created by the migrate step                        |
| `DEFAULT_ADMIN_PASSWORD` | —                | Its password; without it nothing is seeded (logged as a warning) |
| `MAPTILER_KEY`           | —                | Required for `/api/maptiler`; without it the proxy returns 500   |
| `PORT`                   | `4000`           | HTTP port (shared by REST, WebSockets and static files)          |
| `NODE_ENV`               | —                | Only logged; CORS is currently enabled for all origins           |

`.env` files are loaded via `dotenv/config`.

## Users & auth

Accounts live in Postgres (`users`: `id`, `username`, `admin`, and a `password`
column holding a scrypt hash in `salt:hash` form — see `src/util/passwords.ts`).
`POST /api/login` checks the password with a constant-time comparison and
returns a 24-hour HS256 token whose payload is
`{sub: <user id>, username, admin, exp}`.

Access is decided by each route file itself, not by mount order in `src/index.ts` (see Architecture below):

| Scope              | Routes                                                              |
|--------------------|----------------------------------------------------------------------|
| public             | `POST /api/login`, `GET /api/shared/:token`, `GET /api/shared/:token/ws`, static files |
| any logged-in user | `/api/me`, `/api/sims` (incl. `GET /:id/ws`), `/api/status` (incl. `/ws`), `/api/maptiler` |
| admin only         | `/api/users`                                                        |

Two consequences worth spelling out:

- **Per-sim live position needs a token — unless it's shared.** `GET
  /api/sims/:id/ws` requires the same bearer token as the rest of `/api/sims`.
  A simulation's owner can instead call `POST /api/sims/:id/share` to mint a
  separate, unauthenticated share token (see "Sharing simulations" below) and
  hand out `GET /api/shared/:token/ws` to a device under test that has no
  account at all.
- **The map proxy needs a token too.** `/api/maptiler` sits behind the JWT, so
  map clients have to send it; the frontend does that through MapLibre's
  `transformRequest`.
- **A WebSocket can't send an `Authorization` header,** so `jwtMiddleware`
  also accepts the token as a `?token=` query parameter on top of the header —
  every authenticated route gets this for free, not just the WS ones.

There is no refresh flow and no server-side session state: logging out just
discards the token on the client. Never-expiring revocation isn't possible
either — a token stays valid until `exp`, unless a route opts into the
`requireRole(requireAdmin, {checkDb: true})` middleware, which re-reads the user
from the database on each request.

## Sharing simulations

A simulation's owner (`sim_configs.owner_id`, set from the JWT's `sub` at
creation) can expose it to someone without an account:

- `POST /api/sims/:id/share` (owner only, 403 otherwise) mints a share token
  good for 7 days and stores it verbatim in `sim_configs.share_token`, returning
  `{token, expiryDate}`.
- `POST /api/sims/:id/unshare` clears it, immediately invalidating any link
  handed out — even one that hasn't expired yet.
- `GET /api/shared/:token` and `GET /api/shared/:token/ws` are public (no
  bearer token) and return the same `Simulation` shape as their authenticated
  `/api/sims/:id` counterparts, but only while the token is valid.

The share token is **not** a JWT. `src/token.service.ts` implements its own
compact, HMAC-SHA256-signed binary format (owner id + expiry + sim id,
base64url-encoded), signed with the same `JWT_SECRET` via `util/appSecret.ts`
but verified with a constant-time comparison and its own expiry check —
independent of `hono/jwt`. `src/middleware/simShareMiddleware.ts` verifies the
signature and expiry, then checks the decoded owner id and the token itself
still match the simulation's *current* `owner_id`/`share_token` columns before
setting `sim`/`simStream` in context for the `shared.ts` route handlers —
that last check is what makes `unshare` effective immediately rather than only
at expiry.

Ownership otherwise isn't an access-control boundary: `GET/PUT/DELETE
/api/sims*` don't check `owner_id` at all, so any authenticated user can see,
edit or delete any simulation, not just their own.

## Database & migrations

Drizzle ORM (`node-postgres` driver) with the schema in `src/db/schema.ts` and
generated SQL migrations in `drizzle/`, configured by `drizzle.config.ts`.

```bash
pnpm db:generate  # schema change → new migration file in drizzle/
pnpm migrate:dev  # apply migrations + seed the admin (what the deployed image runs)
pnpm migrate      # the same, from a build: node dist/migrate.js
pnpm db:migrate   # drizzle-kit: migrations only, no admin seed
pnpm db:push      # push the schema straight to the DB, no migration file (dev only)
pnpm db:studio    # browse the database
```

**Migrations are never applied by starting the server.** `src/migrate.ts` is a
separate entrypoint that runs them and exits; `src/index.ts` only serves. On a
fresh database use `migrate:dev` rather than `db:migrate` — the latter creates
the schema but not the admin account, leaving no way to log in.

Changing a table means: edit `src/db/schema.ts`, run `pnpm db:generate`, commit
the file it writes into `drizzle/`, run `pnpm migrate:dev`, restart.
`src/types.ts` derives the `User`
type from the schema, so the column change reaches the frontend's types
straight away.

Both users and simulation configs live in Postgres now (`users` and
`sim_configs` tables) — losing the database costs you both accounts and
simulations.

## Simulation model

A simulation is `{ config, state }`:

- **`config`** (`SimConfig`) is the durable part — `id`, `ownerId`, `target`
  position, `initialDistance`, `initialAzimuth`, `type`, `speed` (m/s),
  `playing`, `shareToken`. This is what gets persisted.
- **`state`** (`SimState | null`) is the live part — `current` position,
  `distance`, `azimuth`, `start` timestamp. It is `null` whenever the
  simulation is stopped, and rebuilt from `config` on every start.

Two movement types, both advanced by a **100 ms tick**:

- **`follow`** — moves `current` straight toward `target` at `speed`, snapping
  to the target on the last step and then sitting there at distance 0.
- **`circle`** — orbits `target` at a fixed radius, rotating `azimuth` by the
  angle that corresponds to `speed × delta` along the circumference.

Position math is geodesic, via `@turf/turf` (`util/geoCalc.ts`).

## REST API

All inputs are validated with Zod (`src/zodSchema.ts`). Everything except
`/api/login` expects an `Authorization: Bearer <token>` header.

### `/api/login`

| Method | Path | Body                     | Result                                             |
|--------|------|--------------------------|----------------------------------------------------|
| POST   | `/`  | `{ username, password }` | `{ token }`, or `401 { error }` on bad credentials |

### `/api/me`

`GET /api/me` → `{ id, username, admin, exp }`, read straight from the token —
no database round-trip, so it reflects the claims as they were at login.

### `/api/sims`

| Method | Path                 | Body                      | Result                                                                                                                                                                |
|--------|----------------------|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| GET    | `/`                  | —                         | `Simulation[]`                                                                                                                                                        |
| GET    | `/:id`               | —                         | A single `Simulation`, or `404 { error }` if unknown                                                                                                                  |
| POST   | `/`                  | `simCreateInput`          | The created `Simulation`; only `id` is required, everything else gets a default (random target near Braunschweig, random distance/azimuth, `follow`, 20 m/s, playing) |
| PUT    | `/:id`               | `simConfigInput`          | Updates any subset of the config. Moving the `target` of a `follow` sim recomputes distance/azimuth from the current position so motion continues smoothly            |
| DELETE | `/:id`               | —                         | Removes the simulation and its persisted config                                                                                                                       |
| PUT    | `/:id/updateCurrent` | `{ latitude, longitude }` | Teleports the current position and recomputes the config from it                                                                                                      |
| PUT    | `/:id/start`         | —                         | Resumes a stopped simulation (fresh state from config)                                                                                                                |
| PUT    | `/:id/stop`          | —                         | Pauses it — config is kept and persisted, `state` becomes `null`                                                                                                      |
| GET    | `/:id/ws`            | — (WebSocket upgrade)     | Streams that `Simulation` on every tick; see WebSocket API below                                                                                                      |
| POST   | `/:id/share`         | —                         | Owner only (403 otherwise). Mints a 7-day share token, returns `{ token, expiryDate }`                                                                                |
| POST   | `/:id/unshare`       | —                         | Clears the share token, invalidating any link immediately                                                                                                             |

The mutating routes answer `{ success: true }`, and `404 { error }` for an
unknown id. Note `config` now also carries `ownerId` (the creating user's id)
and `shareToken` (empty string when not shared).

### `/api/status`

| Method | Path  | Body                  | Result                                                                 |
|--------|-------|-----------------------|-------------------------------------------------------------------------|
| GET    | `/`   | —                     | `Status` — `{ startedAt, simListUpdatedAt, numSims }`                    |
| GET    | `/ws` | — (WebSocket upgrade) | Streams `Status` whenever a simulation is created or removed             |

This isn't sim data — it's a cheap signal for clients that hold their own sim
list (e.g. the frontend's REST-fetched list) to know when to refetch it,
without pushing the whole list on every tick.

### `/api/users` (admin only)

| Method | Path   | Body                             | Result                                                      |
|--------|--------|----------------------------------|-------------------------------------------------------------|
| GET    | `/`    | —                                | All users ordered by id                                     |
| GET    | `/:id` | —                                | A single user, or `404 { error }`                           |
| POST   | `/`    | `{ username, password, admin? }` | The created user; the password is hashed before insert      |
| PUT    | `/:id` | any subset of the above          | The updated user; `password` is only re-hashed when present |
| DELETE | `/:id` | —                                | `{ message: 'User deleted' }`                               |

Password hashes never leave the server: `user.service.ts` projects every query
onto the non-secret columns, with a single deliberate exception used by the
login route.

## WebSocket API

| Path                    | Payload      | Auth                                       | Emitted when                                          |
|-------------------------|--------------|---------------------------------------------|--------------------------------------------------------|
| `/api/sims/:id/ws`      | `Simulation` | bearer token (header or `?token=`)          | Every tick of that simulation while it is playing       |
| `/api/shared/:token/ws` | `Simulation` | valid, unexpired share token in the path    | Same, for a shared simulation — no bearer token needed  |
| `/api/status/ws`        | `Status`     | bearer token (header or `?token=`)          | Any simulation created or removed                       |

All three are **push-only**: a client receives a snapshot as soon as it
connects (once authenticated/authorized) and then keeps receiving them. There
is no full-list broadcast any more — `GET /api/sims` is a plain REST fetch,
and `/api/status/ws` only tells clients *when* to refetch it, not what
changed. Connecting to an unknown sim id, or with an invalid, expired or
mismatched share token, returns an error status before the upgrade (`404` for
an unknown id; `400`/`403` for a bad share token).

Under the hood, `util/eventStream.ts` is a small pub/sub whose `.collect()`
returns an async generator; each socket iterates its own generator and releases
it on close.

## Architecture

```
src/index.ts                  app bootstrap; exports `simulationService` (module singleton) and `HonoEnv`
src/simulations.service.ts    owns Map<id, SimulationRuntime>, persistence (Postgres via Drizzle), status/statusStream
src/simulationRuntime.ts      one per simulation: tick loop, movement math, per-sim stream
src/user.service.ts           Drizzle queries for users, with password columns projected away
src/token.service.ts          generate/verify the HMAC-signed share tokens used by simulation sharing
src/migrate.ts                standalone migrate entrypoint (dist/migrate.js); the server never migrates
src/db/                       index.ts (Drizzle client), schema.ts (users + sim_configs tables), dbInit.ts (migrate + seed admin)
src/middleware/auth.ts        jwtMiddleware, requireRole(requireAdmin, {checkDb}) — role check on top of hono/jwt
src/middleware/simShareMiddleware.ts  verifies a share token and loads the matching sim into context
src/zodSchema.ts              Zod input schemas
src/types.ts                  Position, SimConfig, SimState, Simulation, Status, User, Profile, JWTPayload, HonoEnv
src/routes/                   login, users, sims (REST + per-sim WS + share/unshare), shared (public share endpoints),
                               status (REST + WS), me, maptiler (proxy)
src/util/                     eventStream, geoCalc, passwords, randomOffset, appSecret
```

Three things worth knowing before changing anything here:

- **There is no more typed RPC client, only shared data types.** `package.json#exports` still points at
  `./src/index.ts`, and the frontend still imports `Simulation`, `SimConfig`, `Status`, `User`, `Profile` and
  `JWTPayload` from that source — so a Zod schema or database column change still changes frontend *types*
  immediately, with no build in between. But the frontend now calls REST/WS endpoints with a plain `ky` client, so a
  renamed or moved *route* is a runtime error on the frontend, not a compile error. Check both sides by hand.
- **Route handlers import the service from `index.ts`.** `simulationService` is
  a module-level singleton created with top-level `await`; routes import it
  rather than receiving it, so import cycles between `index.ts` and
  `routes/*` are load-order sensitive.
- **Each subapp decides its own access level, not `index.ts`.** Every route file
  under `src/routes/*` applies whatever `.use('*', jwtMiddleware)` /
  `.use('*', requireRole(true))` it needs as the first thing in its own chain
  (`login.ts` and `shared.ts` apply neither → public). Reordering the
  `.route()` calls in `index.ts` changes routing, not who can reach an
  endpoint — unlike before this reorg, where mount order *was* the auth model.

Simulation configs are persisted to Postgres (the `sim_configs` table, via
Drizzle) on every mutation and reloaded from there on startup, so simulations
survive a restart. They come back in whatever `playing` state they were saved
in. On `SIGINT`/`SIGTERM` the process stops all tick intervals,
terminates open sockets and closes the Postgres client, so it can exit on its
own.

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
stripped from responses. Like every other `/api/*` route it requires a bearer
token.

JSON responses (`style.json`, `tiles.json`, …) get absolute
`https://api.maptiler.com/` URLs rewritten back to this proxy. MapLibre calls
`new URL()` on sprite and glyph URLs, so these must stay absolute — the origin
is rebuilt from `x-forwarded-proto` / `x-forwarded-host` when present, so a
TLS-terminating reverse proxy in front of this HTTP server still yields
`https://` URLs. Binary responses (tiles, glyphs, sprites) stream through
untouched.

## Deployment

The repo-root `Dockerfile` builds this package into a single image (build
context **must** be the repo root — the frontend imports its domain types from
here at build time, so both manifests are needed). Releases publish
`ghcr.io/<owner>/sensor-sim` via `.github/workflows/publish.yml`, tagged with the
release version (`v1.2.3` → `1.2.3` and `1.2`) plus `latest` and `sha-<short>`.
`../../compose.yaml` runs it alongside a `db` service — see below for the
volume that matters now that sim configs live in Postgres too.

Deployment is a Portainer (Business Edition) stack fed by a stack webhook. The
compose file resolves its image tag from `SENSOR_SIM_VERSION`, and the publish
workflow POSTs the released version to the webhook as a query parameter
(`…/api/stacks/webhooks/<uuid>?SENSOR_SIM_VERSION=1.2.3`), so Portainer redeploys
on an explicit tag rather than tracking a floating one. The webhook URL lives in
the `PORTAINER_WEBHOOK_URL` repository secret; without it the workflow still
publishes the image and logs a warning instead of deploying. That step runs on
releases only — a manual dispatch has no semver tag to deploy.

The compose file pins an explicit version tag instead of following `latest`.
Startup migrations are forward-only, so a floating tag means any restart that
re-pulls can migrate the database as a side effect — and because the migrator
skips files older than the last applied one, an image rolled back to a previous
version will run *silently* against the newer schema rather than erroring.
Upgrading should be a deliberate bump of the pinned tag; `sha-<short>` tags are
available when you need to pin a build that has no release.

The container needs `DATABASE_URL` (a Postgres it can reach), `JWT_SECRET` and,
for the first run, `DEFAULT_ADMIN_PASSWORD`. There's no volume to mount on the
app container itself any more — both users and simulations persist in that
same Postgres database, so replacing the container loses nothing as long as
`DATABASE_URL` points at a durable `db` service (see its volume below).

The compose file ships that Postgres as a `db` service, so the stack is
self-contained. It brings three services up in a fixed order — `db` (healthy) →
`migrate` (exited 0) → `server` — and each gate is load-bearing:

- `DATABASE_URL` is composed in `compose.yaml` from the `POSTGRES_*` values in
  `.env` and points at host `db` (the service name on the compose network), not
  `localhost`. Keep the password URL-safe — `src/db/index.ts` validates the
  string with `URL.canParse()`.
- `migrate` is a one-shot service on the **same image** with
  `command: ["node", "dist/migrate.js"]` and `restart: "no"` (a restart policy
  would make compose read its expected exit as a failure to stay alive). It runs
  the migrations and the admin seed, then exits. drizzle-kit is a devDependency
  and absent from the image, which is why this runs the compiled entrypoint
  rather than `db:migrate`.
- The server waits on `condition: service_completed_successfully`. A migration
  that fails leaves the server in `created`, never started, and `docker compose
  up` exits non-zero — so a bad migration is a failed deploy instead of an app
  crash-looping against a half-known schema.

Nothing retries a database connection anywhere, so ordering is the only thing
keeping startup sane. Note `depends_on` is ignored under Docker Swarm: these
gates hold on standalone Docker only.

The `db` volume mounts at `/var/lib/postgresql`, which is what the `postgres:18+`
images expect — they refuse to start against the `/var/lib/postgresql/data` path
used by 17 and earlier.

Migrations ship with the image: `package.json#files` is `["dist", "drizzle"]`, so
`pnpm deploy --prod` copies `drizzle/` alongside `dist/`, landing at
`/app/drizzle` — exactly where `dbInit` looks (`<cwd>/drizzle`). A new migration
therefore only needs to be committed; the `migrate` service applies it on the
next deploy.
