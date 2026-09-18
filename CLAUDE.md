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

**Types cross the package boundary through source, not a build.** `@sensor-sim/server`'s `exports` points at
`./src/index.ts`, and it re-exports `AppType` (the Hono route tree) plus the domain types (`Simulation`, `User`,
`JWTPayload`, …). The frontend consumes that with `hc<AppType>(serverUrl)`. Consequence: **editing
`packages/server/src/routes/*`, `zodSchema.ts` or `db/schema.ts` immediately changes frontend types** — check both
sides, and note the Docker build needs both package manifests present for this reason.

**Each subapp under `src/routes/*` declares its own auth — `index.ts` mount order has no security consequences.**
Every route file applies whatever it needs as the first `.use('*', ...)` in its own chain, both exported from
`middleware/auth.ts`:

1. `login.ts` and `simsWebsocket.ts` add no auth `.use()` at all → **public**, no token required (`/api/login`,
   `/ws/sims` — the WebSocket stream is unauthenticated).
2. `maptiler.ts`, `sims.ts` and `me.ts` add `.use('*', authMiddleware)` (`jwt({secret: JWT_SECRET, alg: "HS256"})`) →
   `/api/maptiler`, `/api/sims` and `/api/me` need a valid bearer token.
3. `users.ts` additionally adds `.use('*', verifyAuth(true))` → `/api/users` needs `admin` in the token payload.

`src/index.ts` just mounts each subapp with `.route()`; reordering those calls changes routing, not access level.

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

**Push-only sim state, write-only sim REST.** All live simulation state reaches clients via WebSocket; `/api/sims` is
used exclusively for mutations. Nothing polls. (Users are the exception: they are plain REST reads/writes through
`@solidjs/router` `query`/`action`.)

- `util/eventStream.ts` is a tiny pub/sub whose `.collect()` yields an async generator, consumed directly by the WS
  handlers.
- `simulations.service.ts` owns `Map<id, SimulationRuntime>`, persists `SimConfig` to Postgres via Drizzle
  (`sim_configs`
  table, `db/schema.ts`), and re-emits the sim list every 100ms so list snapshots stay fresh even without config
  changes.
- `simulationRuntime.ts` runs a per-sim 100ms tick advancing `SimState` with geodesic math (`util/geoCalc.ts`, built on
  `@turf/turf`).
- `/ws/sims` streams `Simulation[]`; `/ws/sims/:id` streams a single `Simulation` per tick.
- Frontend `src/service/simulations.service.ts` is the single source of live sim state: one WebSocket, kept in Solid
  stores via `reconcile` (keyed on `config.id`), plus a non-reactive `latestSimulations` snapshot and a listener
  registry for non-Solid consumers.
- `src/components/control/simulationMap.ts` is imperative MapLibre code living *outside* Solid's reactivity — it
  subscribes via that listener registry and writes back through the Hono client on marker drag.

**The JWT travels three ways on the client.** `src/auth.ts` holds one module-level signal backed by
`localStorage["jwt_token"]`. `src/honoClient.ts` injects it as an `Authorization: Bearer` header on every REST call, and
`simulationMap.ts` adds the same header via MapLibre's `transformRequest` for tile/style requests — necessary because
`/api/maptiler` sits behind the JWT middleware. The WebSocket sends no token (it is a public route).

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
