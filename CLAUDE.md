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

pnpm --filter @sensor-sim/server migrate:dev # tsx src/migrate.ts — migrations + admin seed (run before dev)
pnpm --filter @sensor-sim/server db:generate # drizzle-kit: SQL migration from src/db/schema.ts → drizzle/
pnpm --filter @sensor-sim/frontend test      # vitest (jsdom + @solidjs/testing-library)
pnpm --filter @sensor-sim/frontend lint      # oxlint src
```

See `packages/server/CLAUDE.md` and `packages/frontend/CLAUDE.md` for the full per-package script list (build,
start, db:studio, db:push, a single-test invocation, …).

The server needs a reachable Postgres (`DATABASE_URL`) and a `JWT_SECRET` to start at all — `src/db/index.ts` and
`src/routes/login.ts` throw on import if they are missing. It does **not** create or migrate the schema: run
`migrate:dev` first against a fresh database, or the first query fails. `db:migrate` (drizzle-kit) applies the schema
but skips the admin seed, so it leaves you unable to log in.

## Architecture

**One origin in production, two in dev.** The server is the only deployable process: `packages/server/src/index.ts`
mounts the API and also serves the built frontend (`dist/public`, else `../../frontend/dist/client`) with an SPA
fallback. In dev the Vite server on `:3000` talks cross-origin to `:4000`; CORS is currently enabled unconditionally
with `origin: '*'`.

**Types cross the package boundary through source, not a build — but no longer through a typed RPC client.**
`@sensor-sim/server`'s `exports` points at `./src/index.ts`, re-exporting domain types (`Simulation`, `SimConfig`,
`Status`, `User`, `Profile`, `JWTPayload`, …). The frontend imports those directly and calls REST/WS endpoints with a
plain `ky` client — a Zod schema or DB column change still changes frontend *data* types immediately, but a renamed
route is no longer caught by the compiler, only by hitting the endpoint.

**Each subapp under `src/routes/*` declares its own auth — mount order in `index.ts` has no security consequences.**
`login.ts`/`shared.ts` are public; `maptiler.ts`/`sims.ts`/`me.ts`/`status.ts` require `jwtMiddleware` (bearer token,
header or `?token=`); `users.ts` additionally requires `requireRole(true)` (admin). `sims.ts` further scopes every
`/:id*` route to the sim's owner via `withOwnSimMiddleware` (404 unknown id, 403 non-owner) — **simulations are
owner-scoped**, `GET /api/sims` lists only the caller's own, and a share link (`POST /:id/share`, a separate
non-JWT HMAC token) is the only way to expose one to someone else. Full breakdown, including the middleware split
(`jwtAuth.ts` / `requireRole.ts` / `withOwnSim.ts` / `simShareMiddleware.ts`) and the sharing token format, is in
`packages/server/CLAUDE.md`.

**One database, two tables, migration-managed.** Both `sim_configs` and `users` live in the same Postgres DB via
Drizzle — losing the database costs you both. `src/migrate.ts` is a separate tsup entrypoint that applies pending
migrations and seeds the admin; `src/index.ts` never migrates. In the compose stack this runs as a one-shot service
the server waits on, so a failed migration is a failed deploy, not a crash loop.

**Sim list over REST + a status ping; per-sim live state over its own WebSocket — except `SimDetails.tsx`.** There is
no full-list push socket: `GET /api/sims` is a plain owner-filtered REST list, refetched via `@solidjs/router`
`query()` (`fetchSimulations`) whenever `/api/status/ws` signals `simListUpdatedAt` changed. Live per-sim position
comes from `GET /api/sims/:id/ws`, consumed via `addSimulationListener` in `simulation.service.ts` — but only
`simulationMap.ts` subscribes to that now. `SimDetails.tsx` instead reads a sim's config through a one-shot
`fetchSimulation(id)` query, so it no longer shows live position. See `packages/frontend/CLAUDE.md` for the full data
flow.

**The JWT travels three ways on the client.** `src/api.ts` sets it as an `Authorization: Bearer` header on REST
calls; `simulationMap.ts` does the same via MapLibre's `transformRequest` (needed since `/api/maptiler` is
authenticated); the per-sim/status WebSockets carry it as `?token=` since a browser `WebSocket` can't set headers.
The public share-link WebSocket sends no token at all.

**MapTiler keys stay server-side.** `/api/maptiler/:path` proxies `api.maptiler.com`, injects `MAPTILER_KEY`, strips
any client-supplied `key`, and rewrites absolute MapTiler URLs in JSON responses back to the proxy.

## Frontend: SolidJS 2.x, not React

See `packages/frontend/CLAUDE.md`

Routing is filesystem-based (`@solidjs/router`) over `src/routes`, with no `index.html`/mount file
(`@solidjs/vite-plugin` turnkey mode generates entries around `src/App.tsx`/`src/Document.tsx`). `file-routes.d.ts`
is generated — don't edit it. Styling is Tailwind 4 + DaisyUI.

## Env vars

Server: `PORT` (4000), `NODE_ENV`, `MAPTILER_KEY` (required for the map proxy), `DATABASE_URL` (**required**,
Postgres), `JWT_SECRET` (**required**), `DEFAULT_ADMIN_USERNAME` (`admin`), `DEFAULT_ADMIN_PASSWORD` (seeds the first
admin; no seeding without it).
Frontend: `VITE_MAP_STYLE` (MapLibre style URL; see `.env.development` / `.env.production`).

## Release

Docker: `Dockerfile` must be built with the **repo root as context** (the frontend needs the server's source for its
type exports at build time). `.github/workflows/publish.yml` publishes `ghcr.io/<owner>/sensor-sim` on GitHub
releases, tagged with the release version plus `latest`/`sha-<short>`, and pings a Portainer stack webhook to deploy.
`compose.yaml` runs `db` (Postgres) → `migrate` (one-shot, must exit 0) → `server`, in that order — `depends_on` is
ignored under Swarm, so this ordering only holds on standalone Docker. The compose file **pins an explicit version
tag** rather than `latest`, because migrations are forward-only and a rollback would otherwise run an old image
silently against a newer schema. Full deployment detail (volumes, env assembly, the `migrate` service) is in
`packages/server/README.md`.
