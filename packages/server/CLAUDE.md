# packages/server

Standalone Node.js simulation engine (`@sensor-sim/server`), a single Hono app served over one HTTP server via
`@hono/node-server`. Listens on `PORT` (default `4000`). It also owns the user store (Postgres via Drizzle) and the
JWT auth for the whole system, and in production serves the built frontend too (see "Static frontend & map proxy"
below).

The process refuses to start without `DATABASE_URL` and `JWT_SECRET` — `src/db/index.ts`, `src/routes/login.ts` and
`src/middleware/jwtAuth.ts` throw at import time. For the full REST/WebSocket reference and env var table, see
`README.md` in this package — this file focuses on the rules an agent needs before changing code.

## Source layout (`src/`)

- `index.ts` — bootstrap: creates the simulation service, mounts routes as a flat list (mount order has no security
  consequences — see "Auth" below), serves the built frontend, handles SIGINT/SIGTERM shutdown. Exports
  `simulationService` (module singleton) and re-exports `types.ts`, including `HonoGlobalVars` (`{user}`, set by
  `jwtMiddleware`) and `HonoSimVars` (`HonoGlobalVars & {sim, simStream}`, set by `withOwnSimMiddleware`) — the
  `Variables` types each subapp's `Hono<{Variables: ...}>()` uses.
- `zodSchema.ts` — Zod input schemas (`simConfigInput`, `simCreateInput`, `positionInput`, `userInput`, `loginInput`).
- `types.ts` — domain types: `Position`, `SimConfig` (`ownerId`, `shareToken`, …), `SimState`, `Simulation`
  (`{config, state}`), `Status`, `User`/`Profile` (`{id, username, admin}`, no `exp`), `JWTPayload` (adds `exp`),
  `HonoGlobalVars`, `HonoSimVars`.
- `simulations.service.ts` — orchestrator. Owns `Map<id, SimulationRuntime>`, persists `SimConfig` to Postgres
  (`sim_configs`, reloaded on startup), exposes `createSim`/`update`/`remove`/`startSim`/`stopSim`/`list(ownerId)`
  (owner-filtered)/`get`/`getSimStream`, plus a `Status`/`statusStream` — a cheap "list changed" signal, not the
  list itself.
- `simulationRuntime.ts` — per-sim 100ms tick advancing `SimState` for `follow`/`circle` modes via `util/geoCalc.ts`
  (`@turf/turf`); owns that sim's `simStream`.
- `token.service.ts` — `generateToken`/`verifyAndDecode`: a non-JWT, HMAC-SHA256-signed capability token for
  simulation sharing (see "Sharing" below) — deliberately separate from `hono/jwt`.
- `db/` — `index.ts` (Drizzle client), `schema.ts` (`users`, `sim_configs` tables), `dbInit.ts` (applies migrations +
  seeds the admin, invoked only from `migrate.ts`). `migrate.ts` is a **second build entrypoint**
  (`dist/migrate.js`), never imported by `index.ts` — `tsup.config.ts` must list both, and the build script must
  call plain `tsup` (a CLI positional silently drops it).
- `user.service.ts` — Drizzle queries for users; every export projects columns **minus `password`** except
  `getUserWithSecretsByName`, used only by login.
- `util/` — `passwords.ts` (scrypt hash/verify), `appSecret.ts` (validates `JWT_SECRET`, shared by
  `middleware/jwtAuth.ts` and `token.service.ts`), `eventStream.ts` (tiny pub/sub; `.collect()` → async generator
  for WS handlers), `geoCalc.ts` (geodesic helpers), `randomOffset.ts`.
- `middleware/jwtAuth.ts` — `jwtMiddleware`: runs `hono/jwt`'s check, then sets `c.set('user', {id, username,
  admin})` from the decoded payload — everything downstream reads `c.get('user')`, not the raw JWT payload. Also
  `wsJwtMiddleware`, which copies a `?token=` query param into `Authorization` first (WebSocket upgrades can't set
  headers) — apply only to `/ws` routes.
- `middleware/requireRole.ts` — `requireRole(requireAdmin, {checkDb})`: 401 without a user, 403 if admin required
  and missing. Assumes `jwtMiddleware` already ran; `checkDb: true` re-reads the DB instead of trusting the token
  (unused today).
- `middleware/withOwnSim.ts` — `withOwnSimMiddleware(idParamKey = "id")`: assumes `jwtMiddleware` ran, loads the sim
  from that route param, 404 if unknown, 403 if `sim.config.ownerId !== user.id`, else sets `sim`/`simStream` in
  context. Mounted on `sims.ts`'s `/:id/*` routes.
- `middleware/simShareMiddleware.ts` — verifies a `:token` path param via `token.service.ts`, and additionally
  checks it still equals the sim's *current* `shareToken` (so unshare/re-share invalidates old links immediately).
  Used only by `routes/shared.ts`.
- `routes/` — `login.ts` (public), `users.ts` (admin-only CRUD), `sims.ts` (simulation REST + per-sim `/:id/ws` +
  share/unshare, owner-scoped), `shared.ts` (public, share-token gated), `status.ts`, `me.ts`, `maptiler.ts` (proxy).

## Auth — each subapp declares its own requirement

```
routes/login.ts, routes/shared.ts                    no .use() at all                        → PUBLIC
routes/maptiler.ts, routes/me.ts, routes/status.ts    .use('*', jwtMiddleware)                → any authenticated user
routes/sims.ts                                        .use('*', jwtMiddleware)
                                                       .use('/:id/*', withOwnSimMiddleware()) → authenticated, /:id/* owner-only
routes/users.ts                                       .use('*', jwtMiddleware).use('*', requireRole(true)) → admin only
```

`src/index.ts` mounts all subapps as a flat list of `.route()` calls — reordering them changes routing, not access
level, since each file applies its own auth as the first `.use('*', ...)` in its chain. `routes/shared.ts` is public
in a different sense: no `jwtMiddleware`, but every path is gated by `simShareMiddleware` instead.

- `/api/sims/:id/ws` needs a bearer token *and* ownership — `withOwnSimMiddleware` 403s a non-owner. Share the sim
  instead (below) to expose it to someone else.
- Every other `/api/sims/:id*` route (read, update, delete, start/stop, updateCurrent, share/unshare) is likewise
  owner-scoped; only `GET /` (filtered to the caller's own sims) and `POST /` (create) skip it.
- `/api/maptiler` is behind the JWT too — the frontend sends it via MapLibre's `transformRequest`.

`POST /api/login` signs an HS256 token, payload `{sub: user.id, username, admin, exp}`, valid 24h. `GET /api/me`
echoes `id`/`username`/`admin` (no `exp` — `Profile` doesn't carry it). No refresh flow, no server-side session —
logout just drops the client-side token.

## Sharing simulations

`sim_configs.owner_id` is set from the JWT's `sub` at `POST /api/sims` time, and `withOwnSimMiddleware` enforces it
as a real ACL on every `/api/sims/:id*` route — so `POST /:id/share`/`unshare` don't re-check ownership themselves,
they just run after it. `share` mints a 7-day HMAC token (`token.service.ts`) into `sim_configs.share_token`;
`unshare` clears it. `routes/shared.ts` then serves `GET /:token` and `GET /:token/ws` with **no JWT at all** —
`simShareMiddleware` checks the token's signature, expiry, and that it still matches the sim's current
`share_token` and owner.

## REST & WebSocket API

Full endpoint tables are in `README.md`. Rules worth knowing here: all inputs are Zod-validated
(`src/zodSchema.ts`); the frontend calls these with a plain `ky` client and imports response *types* from this
package's source, so a schema/column change still changes frontend types immediately, but a renamed route is only
caught at runtime. Every `/api/sims/:id*` route 404s an unknown id and 403s a non-owner before running its handler.
There's no `updateTarget` endpoint — move the target with `PUT /:id`. There's no full-list broadcast socket —
`GET /api/sims` is a plain REST fetch and `/api/status/ws` only signals *that* the list changed.

## Database & migrations

Drizzle Kit config: `drizzle.config.ts` (schema `./src/db/schema.ts`, output `./drizzle`). **The server never
migrates itself** — `pnpm migrate:dev` (tsx) / `pnpm migrate` (built) run `src/migrate.ts`, which applies pending
migrations and seeds the admin; `pnpm db:migrate` (drizzle-kit) applies the schema only, skipping the seed, leaving
no account to log in with. Workflow for a schema change: edit `db/schema.ts` → `pnpm db:generate` → commit the
generated file in `drizzle/` → `pnpm migrate:dev` → restart. See root `CLAUDE.md` for the full command list.

## Static frontend & map proxy

`index.ts` serves a built frontend from `dist/public` (bundled by `pnpm build`) or, failing that,
`../../frontend/dist/client` (monorepo source build); unmatched GETs fall back to `index.html` for SPA routing.
`routes/maptiler.ts` forwards `GET /api/maptiler/:path` to `api.maptiler.com`, injects `MAPTILER_KEY` server-side,
strips any client-supplied `key`, and rewrites absolute MapTiler URLs in JSON responses back to the proxy —
authenticated like any other route file.

## Env vars

`PORT` (4000), `NODE_ENV` (logged only — CORS is open regardless), `MAPTILER_KEY` (required for the map proxy),
`DATABASE_URL`/`JWT_SECRET` (**required**), `DEFAULT_ADMIN_USERNAME` (`admin`), `DEFAULT_ADMIN_PASSWORD` (no
seeding without it). Loaded via `dotenv/config`.

`http/users.http` holds ready-made requests for the user/login endpoints (stores the login token in `auth_token`
for the calls below it).
