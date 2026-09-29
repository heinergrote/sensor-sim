# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GPS simulation monorepo (pnpm workspaces). Simulations move toward a target (`follow`) or orbit it (`circle`) and
broadcast their position in real time over WebSockets. Access is gated by JWT auth against a Postgres-backed user
store.

```
packages/shared      – network contract: Zod request/response schemas + DTO types, SimState, StatusMessage, Profile
packages/server      – Hono + ws: sim configs (Postgres/Drizzle), in-memory simulation engine, users, JWT auth,
                       MapTiler proxy; serves the built frontend in prod
packages/frontend    – SolidJS 2.x management UI (MapLibre map, sim controls, login, user admin)
```

**Read `packages/server/CLAUDE.md` or `packages/frontend/CLAUDE.md` before working in a package** — module layout,
auth rules, data flow and gotchas live there, not here. Each package's `README.md` holds the human-facing API/env
reference.

## Commands

Run from the repo root:

```bash
pnpm dev                                     # server (:4000) + frontend (:3000) in parallel
pnpm dev:server                              # server only (tsx watch)
pnpm dev:frontend                            # frontend only (vite)
pnpm build                                   # = server build (builds the frontend first)
pnpm typecheck                               # tsc --noEmit in all packages

pnpm --filter @sensor-sim/server migrate:dev # migrations + admin seed — run before first dev start
pnpm --filter @sensor-sim/server db:generate # drizzle-kit: SQL migration from src/db/schema.ts → drizzle/
pnpm --filter @sensor-sim/frontend test      # vitest (jsdom + @solidjs/testing-library)
pnpm --filter @sensor-sim/frontend lint      # oxlint src
```

The server needs `DATABASE_URL` and `JWT_SECRET` or it throws on import. It never migrates itself: run `migrate:dev`
against a fresh DB. `db:migrate` (drizzle-kit) applies the schema but skips the admin seed — no way to log in.

## Cross-cutting architecture

**Config and runtime are separate.** A *sim config* (`sim_configs` row, `/api/configs`) is the persisted, editable
definition; a *simulation* (`/api/sims`) is the read-only in-memory runner derived from it, exposing `SimState`.
Every write goes through `/api/configs` (start/stop included — they just flip `playing`); the server then resyncs
the engine from the DB and pings `/api/status/ws` so clients refetch the config list.

**Two type layers, one shared surface.** DB row types come from Drizzle (`packages/server/src/db/schema.ts`);
network DTOs are `z.infer`'d from the Zod schemas in `@sensor-sim/shared` and converted by the server's
`<module>/*mappings.ts` (`toInsert`/`toUpdate`/`toDto`). `packages/shared` is the only surface the frontend sees —
never put row types or server-only code (Drizzle, Hono, node APIs) in it. Pure helpers used on both sides
live there too (`@sensor-sim/shared/geoUtils`, a subpath export so the frontend doesn't pull in the Zod schemas).

**Types cross the package boundary through source, not an RPC client.** `@sensor-sim/shared`'s `exports` points at
`src/index.ts` (no build step); server and frontend both depend on it, the frontend calls endpoints with plain `ky`.
A schema change breaks `tsc` on both sides; a renamed route only fails at runtime. Because it ships `.ts`, the
server's `tsup.config.ts` bundles it (`noExternal`) — the prod `node dist/index.js` never loads it from node_modules.

**One origin in prod, two in dev.** The server serves `dist/public` (else `../../frontend/dist/client`) with SPA
fallback. In dev Vite (`:3000`) talks cross-origin to `:4000`; CORS is `origin: '*'` unconditionally.

**Each subapp declares its own auth** — mount order in `index.ts` is not a security boundary. Configs and sims are
owner-scoped; a share link (HMAC token, not a JWT) is the only way to expose a sim to someone else. Details:
`packages/server/CLAUDE.md`.

**The JWT travels three ways on the client:** `Authorization: Bearer` on REST (`src/api.ts`), the same header via
MapLibre `transformRequest` (the MapTiler proxy is authenticated), and `?token=` on WebSockets. MapTiler keys never
leave the server.

**One database, two tables** (`users`, `sim_configs`), migration-managed via the separate `src/migrate.ts` entrypoint.

## Frontend: SolidJS 2.x, not React

Components run once; reactivity is signals. Filesystem routing over `src/routes` (`file-routes.d.ts` is generated —
don't edit). Tailwind 4 + DaisyUI. See `packages/frontend/CLAUDE.md`.

## Env vars

Server: `PORT` (4000), `NODE_ENV`, `MAPTILER_KEY`, `DATABASE_URL` (**required**), `JWT_SECRET` (**required**),
`DEFAULT_ADMIN_USERNAME` (`admin`), `DEFAULT_ADMIN_PASSWORD` (no seeding without it).
Frontend: `VITE_MAP_STYLE` (MapLibre style URL; see `.env.development` / `.env.production`).

## Release

`Dockerfile` must be built with the **repo root as context**. `.github/workflows/publish.yml` publishes
`ghcr.io/<owner>/sensor-sim` on GitHub releases (version, `latest`, `sha-<short>`) and pings a Portainer webhook.
`compose.yaml` runs `db` → `migrate` (one-shot, must exit 0) → `server` (standalone Docker only; Swarm ignores
`depends_on`) and **pins an explicit version tag** — migrations are forward-only. Migration `0007` **deletes all
existing `sim_configs` rows** (id became a serial int). Deployment detail: `packages/server/README.md`.
