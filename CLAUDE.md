# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GPS simulation monorepo (pnpm workspaces). Simulations move along routes (`follow`) or orbit a center (`circle`) and
broadcast their position in real time over WebSockets. Access is gated by JWT auth against a Postgres-backed user
store.

```
packages/server      – simulation engine (Hono + ws), REST + WebSocket API, users (Postgres/Drizzle), JWT auth,
                       MapTiler proxy, serves the built frontend in prod
packages/frontend    – SolidJS 2.x management UI (MapLibre map, live sim controls, login, user admin)
```

Per-package detail lives in `packages/server/CLAUDE.md` and `packages/frontend/CLAUDE.md` — read the relevant one before
working in a package. Each package also has a human-facing `README.md` covering its API, env vars and scripts.

## Commands

Run from the repo root:

```bash
pnpm dev                                     # server (:4000) + frontend (:3000) in parallel
pnpm dev:server                              # server only (tsx watch)
pnpm dev:frontend                            # frontend only (vite)
pnpm build                                   # = server build (which builds the frontend first)
pnpm typecheck                               # tsc --noEmit in both packages

pnpm --filter @sensor-sim/server typecheck   # tsc --noEmit
pnpm --filter @sensor-sim/server build       # builds frontend → typechecks → tsup → copies frontend into dist/public
pnpm --filter @sensor-sim/server start       # node dist/index.js
pnpm --filter @sensor-sim/server migrate:dev # tsx src/migrate.ts — migrations + admin seed (run before dev)
pnpm --filter @sensor-sim/server migrate     # node dist/migrate.js — same, from a build (used in the image)
pnpm --filter @sensor-sim/server db:generate # drizzle-kit: SQL migration from src/db/schema.ts → drizzle/
pnpm --filter @sensor-sim/server db:studio   # drizzle-kit studio

pnpm --filter @sensor-sim/frontend typecheck # tsc --noEmit
pnpm --filter @sensor-sim/frontend lint      # oxlint src
pnpm --filter @sensor-sim/frontend test      # vitest (jsdom + @solidjs/testing-library)
```

A single frontend test: `pnpm --filter @sensor-sim/frontend test -- run src/components/Foo.test.tsx`, or
`-t "<test name>"`. Note there are currently no test files; `vitest` is configured and ready.

The server needs a reachable Postgres (`DATABASE_URL`) and a `JWT_SECRET` to start at all — `src/db/index.ts` and
`src/routes/login.ts` throw on import if they are missing. It does **not** create or migrate the schema: run
`migrate:dev` first against a fresh database, or the first query fails. Note `db:migrate` (drizzle-kit) applies the
schema but skips the admin seed, so it leaves you unable to log in.

## Architecture

**One origin in production, two in dev.** The server is the only deployable process: `packages/server/src/index.ts`
mounts the API and also serves the built frontend (`dist/public`, else `../../frontend/dist/client`) with an SPA
fallback to `index.html`. In dev the Vite server on `:3000` talks cross-origin to `:4000`; CORS is currently enabled
unconditionally with `origin: '*'`. The frontend picks its base URL accordingly
(`import.meta.env.DEV ? "http://localhost:4000" : window.location.origin`).

**Types cross the package boundary through source, not a build — but no longer through a typed RPC client.**
`@sensor-sim/server`'s `exports` points at `./src/index.ts`, which re-exports the domain types (`Simulation`,
`SimConfig`, `Status`, `User`, `Profile`, `JWTPayload`, …). The frontend imports those types directly and calls the
REST/WS endpoints with a plain `ky` client (`src/api.ts`) — there is no more `hc<AppType>` typed Hono client and no
`AppType` export at all. Consequence: **editing `packages/server/src/routes/*`, `zodSchema.ts` or `db/schema.ts`
still immediately changes frontend *data* types**, but a renamed route or path is no longer caught by the
compiler — only by hitting the endpoint. The Docker build still needs both package manifests present, since the
frontend package depends on `@sensor-sim/server`'s source for those type exports.

**Each subapp under `src/routes/*` declares its own auth — `index.ts` mount order has no security consequences.**
Every route file applies whatever it needs as the first `.use('*', ...)` in its own chain, both exported from
`middleware/auth.ts`:

1. `login.ts` and `shared.ts` add no auth `.use()` at all → **public**, no token required (`/api/login`,
   `/api/shared/:token` and `/api/shared/:token/ws` — the latter gated instead by a per-simulation share token, see
   "Sharing" below).
2. `maptiler.ts`, `sims.ts`, `me.ts` and `status.ts` add `.use('*', jwtMiddleware)` (`jwt({secret: JWT_SECRET, alg:
   "HS256"})`) → `/api/maptiler`, `/api/sims` (including its per-sim `GET /:id/ws`), `/api/me` and `/api/status`
   (including `/api/status/ws`) need a valid bearer token. `jwtMiddleware` also accepts the token as a `?token=`
   query param, not just the `Authorization` header — needed because a browser `WebSocket` can't set custom headers
   on the upgrade request.
3. `users.ts` additionally adds `.use('*', requireRole(true))` → `/api/users` needs `admin` in the token payload.

`src/index.ts` just mounts each subapp with `.route()`; reordering those calls changes routing, not access level.

**Simulations have an owner but aren't owner-scoped, except for sharing.** `sim_configs.owner_id` (FK → `users.id`)
records who created a sim (`POST /api/sims` reads it off the JWT's `sub`), but `GET/PUT/DELETE /api/sims*` don't
filter or check it — any authenticated user can list, read, update or delete any simulation. Ownership only gates
`POST /api/sims/:id/share` and `/unshare` (403 if the caller isn't the owner). Sharing itself is a *separate*,
non-JWT credential: `token.service.ts` mints a compact HMAC-SHA256-signed token (binary: owner id + expiry + sim id,
base64url-encoded, signed with the same `JWT_SECRET` via `util/appSecret.ts`) that's stored verbatim in
`sim_configs.share_token` and handed back to the owner. `middleware/simShareMiddleware.ts` verifies a token's
signature and expiry, then additionally checks it still matches the sim's current `share_token` column (so
un-sharing or re-sharing invalidates old links immediately, without waiting for expiry) before exposing `GET
/api/shared/:token` and `/api/shared/:token/ws` — both fully public, no bearer token needed.

**One database, two tables, migration-managed.** Both simulation configs (`sim_configs`) and users (`users`) live in
the same Postgres DB via Drizzle — there's no separate file-based store any more. `db/dbInit.ts` applies pending
migrations from `<cwd>/drizzle` and seeds a default admin from `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD`
(skipped with a warning if the password is unset). Consequence: losing the database now costs you both accounts and
simulations — there's no separate store to fall back on.

**Migrations are a separate step, not part of app boot.** `src/migrate.ts` is a second tsup entrypoint
(`dist/migrate.js`) that calls `dbInit()` and exits 0/1; `src/index.ts` never migrates. In the compose stack a one-shot
`migrate` service runs it and the server waits on `condition: service_completed_successfully`, so a failed migration is
a failed deploy rather than a server crash-looping against a half-known schema. Consequences: `tsup.config.ts` lists
both entrypoints (and the build script must call plain `tsup` — a CLI positional would override that list), and a fresh
database needs `migrate:dev` before `pnpm dev`.

**Sim list over REST + a lightweight status ping; per-sim live state over its own WebSocket.** There is no longer a
single socket that pushes the whole `Simulation[]` list. Instead:

- `util/eventStream.ts` is a tiny pub/sub whose `.collect()` yields an async generator, consumed directly by the WS
  handlers.
- `simulations.service.ts` owns `Map<id, SimulationRuntime>`, persists `SimConfig` to Postgres via Drizzle
  (`sim_configs` table, `db/schema.ts`), and exposes a `Status` (`{startedAt, simListUpdatedAt, numSims}`) plus a
  `statusStream` that re-emits whenever a sim is created or removed — a cheap "does the list need a refetch" signal,
  not the list itself.
- `simulationRuntime.ts` runs a per-sim 100ms tick advancing `SimState` with geodesic math (`util/geoCalc.ts`, built on
  `@turf/turf`), and owns that sim's own `simStream`.
- `GET /api/sims` is a plain, cacheable REST list (no push); `GET /api/sims/:id/ws` and `GET
  /api/shared/:token/ws` each stream a single `Simulation` per tick for one sim (authenticated vs. share-token
  gated, respectively); `GET /api/status/ws` streams `Status` whenever the list changes shape.
- Frontend `src/service/simulations.service.ts` fetches the list via `@solidjs/router` `query()` (`fetchSimulations`,
  cache key `"simulations"`) and keeps one `/api/status/ws` connection open; on a `Status` message whose
  `simListUpdatedAt` advanced, it calls `revalidate("simulations")` to refetch the list. It also exposes the
  mutation actions (`addSim`, `updateSim`, `startSim`, `stopSim`, `share`, `unShare`, …) around the `ky` client.
- Frontend `src/service/simulation.service.ts` is the source of *live* per-sim state: `addSimulationListener(id,
  cb)` lazily opens (and ref-counts) one WebSocket per sim id against `/api/sims/:id/ws`, closing it once the last
  listener unsubscribes. `SimDetails.tsx` and `simulationMap.ts` both subscribe through it rather than opening their
  own sockets.
- `src/components/control/simulationMap.ts` is imperative MapLibre code living *outside* Solid's reactivity — it
  subscribes via that per-sim listener registry and writes back through the `ky`-based service on marker drag.

**The JWT travels three ways on the client.** `src/auth.ts` holds one module-level signal backed by
`localStorage["jwt_token"]`. `src/api.ts` (`ky.extend`) injects it as an `Authorization: Bearer` header on every REST
call, and `simulationMap.ts` adds the same header via MapLibre's `transformRequest` for tile/style requests —
necessary because `/api/maptiler` sits behind the JWT middleware. The per-sim and status WebSockets carry it too, but
as a `?token=` query param (`jwtMiddleware` reads either) since a browser `WebSocket` can't set the header itself.
The one WebSocket that sends no token at all is the public share link, `/api/shared/:token/ws` — it's gated by the
share token in the path instead.

**MapTiler keys stay server-side.** `/api/maptiler/:path` proxies `api.maptiler.com`, injects `MAPTILER_KEY`, strips any
client-supplied `key`, and rewrites absolute MapTiler URLs in JSON responses (style.json, tiles.json) back to the proxy.

## Frontend: SolidJS 2.x, not React

Components run **once** — there is no re-render. Reactivity is fine-grained through signals; effects and memos have
Solid-specific semantics. Do not port React patterns.

Two versioned agent skills ship inside `node_modules` and match the installed versions — read them on demand:

- `node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md` — maps each dev-mode diagnostic code
  (`REACTIVE_WRITE_IN_OWNED_SCOPE`, `STRICT_READ_UNTRACKED`, …) to its prescribed fix. Read it whenever such a code
  appears in test output or the console.
- `node_modules/@solidjs/diagnostics/skills/agent-loops/SKILL.md` — how to capture reactive evidence (which scopes
  re-ran and why, wasted recomputes) and assert budgets.

When debugging reactivity, capture evidence rather than guessing: `captureArtifact()` + the
`@solidjs/diagnostics/vitest` matchers in tests, or the `/__solid/diagnostics` dev-server endpoint (needs
`diagnostics: true` in `vite.config.ts`, currently `false`). Name your signals/memos/effects — attribution reports
scopes by name.

Routing is filesystem-based (`filesystem-routing` + `@solidjs/router`) over `src/routes` (`index`, `control`, `users/`,
`users/[id]`, `[...404]`), with no `index.html` and no mount file: `@solidjs/vite-plugin`'s turnkey mode (`start: true`)
generates entries around `src/App.tsx` and `src/Document.tsx`. `src/router.ts` exports the `Router` plus typed `paths`
helpers; `file-routes.d.ts` is generated — don't edit it. Styling is Tailwind 4 + DaisyUI.

## Env vars

Server: `PORT` (4000), `NODE_ENV`, `MAPTILER_KEY` (required for the map proxy), `DATABASE_URL` (**required**,
Postgres), `JWT_SECRET` (**required**), `DEFAULT_ADMIN_USERNAME` (`admin`), `DEFAULT_ADMIN_PASSWORD` (seeds the first
admin; no seeding without it).
Frontend: `VITE_MAP_STYLE` (MapLibre style URL; see `.env.development` / `.env.production`).

## Release

- Docker: `Dockerfile` must be built with the **repo root as context**. `.github/workflows/publish.yml` publishes
  `ghcr.io/<owner>/sensor-sim` on GitHub releases and on manual dispatch, tagged `<version>` + `<major>.<minor>` (from
  the release's git tag), `latest` and `sha-<short>`; `compose.yaml` runs it alongside a `postgres:18-alpine` `db`
  service (volume at `/var/lib/postgresql`, the path 18+ images require) — that's the only persistent volume in the
  stack now that sim configs live in the same database as users. `DATABASE_URL` is assembled in `compose.yaml` from
  the `POSTGRES_*` vars in `stack.env` and points at the `db` service name. Service order is `db` (healthy) →
  `migrate` (exited 0) → `server`; nothing retries a failed connection, so both gates are load-bearing. Note
  `depends_on` is ignored by Swarm — this ordering only holds on standalone Docker.
- Deploys land on a Portainer BE stack: the publish workflow POSTs the released version to a stack webhook
  (`PORTAINER_WEBHOOK_URL` secret) as `?SENSOR_SIM_VERSION=<version>`, which compose resolves into the image tag. The
  step is release-only, since a manual dispatch produces no semver tag.
- `compose.yaml` **pins an explicit version tag** rather than tracking `latest`, because migrations are forward-only:
  with a floating tag any restart that re-pulls can migrate the database as a side effect, and rolling the image back
  does not roll the schema back (the migrator skips files older than the last applied one, so the old image runs
  *silently* against the newer schema). The webhook supplies that version per deploy.
- The container needs `DATABASE_URL` pointing at a reachable Postgres plus `JWT_SECRET`. `package.json#files` is
  `["dist", "drizzle"]` so `pnpm deploy --prod` carries the migrations into the image at `/app/drizzle`, where the
  migrate entrypoint reads them — a new migration only has to be committed, never copied separately.
