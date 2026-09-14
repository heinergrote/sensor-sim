# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GPS simulation monorepo (pnpm workspaces). Simulations move along routes (`follow`) or orbit a center (`circle`) and
broadcast their position in real time over WebSockets.

```
packages/server      – simulation engine (Hono + ws), REST + WebSocket API, MapTiler proxy, serves the built frontend in prod
packages/frontend    – SolidJS 2.x management UI (MapLibre map, live sim controls)
```

Per-package detail lives in `packages/server/AGENTS.md` and `packages/frontend/AGENTS.md` — read the relevant one before
working in a package. Each package also has a human-facing `README.md` covering its API, env vars and scripts.

## Commands

Run from the repo root:

```bash
pnpm dev                                    # server (:4000) + frontend (:3000) in parallel
pnpm dev:server                              # server only (tsx watch)
pnpm dev:frontend                            # frontend only (vite)
pnpm build                                   # -r build across packages

pnpm --filter @sensor-sim/server typecheck   # tsc --noEmit
pnpm --filter @sensor-sim/server build       # builds frontend → typechecks → tsup → copies frontend into dist/public
pnpm --filter @sensor-sim/server start       # node dist/index.js

pnpm --filter @sensor-sim/frontend lint      # oxlint src
pnpm --filter @sensor-sim/frontend test      # vitest (jsdom + @solidjs/testing-library)

```

A single frontend test: `pnpm --filter @sensor-sim/frontend test -- run src/components/Foo.test.tsx`, or
`-t "<test name>"`. Note the frontend has no `typecheck` script and currently no test files; `vitest` is configured and
ready.

## Architecture

**One origin in production, two in dev.** The server is the only deployable process: `packages/server/src/index.ts`
mounts the API and also serves the built frontend (`dist/public`, else `../../frontend/dist/client`) with an SPA
fallback to `index.html`. In dev the Vite server on `:3000` talks cross-origin to `:4000`, which is why CORS is enabled
only when `NODE_ENV=development`. The frontend picks its base URL accordingly
(`import.meta.env.DEV ? "http://localhost:4000" : window.location.origin`).

**Types cross the package boundary through source, not a build.** `@sensor-sim/server`'s `exports` points at
`./src/index.ts`, and it re-exports `AppType` (the Hono route tree) plus the domain types. The frontend consumes that
with `hc<AppType>(serverUrl)`. Consequence: **editing `packages/server/src/routes/*` or `zodSchema.ts` immediately
changes
frontend types** — check both sides, and note the Docker build needs both package manifests present for this reason.

**Push-only state, write-only REST.** All live state reaches clients via WebSocket; REST is used exclusively for
mutations. Nothing polls.

- `util/eventStream.ts` is a tiny pub/sub whose `.collect()` yields an async generator, consumed directly by the WS
  handlers.
- `simulations.service.ts` owns `Map<id, SimulationRuntime>`, persists `SimConfig` via `unstorage` (fs driver,
  `STORAGE_DIR`) so sims survive restarts, and re-emits the sim list every 200ms so list snapshots stay fresh even
  without config changes.
- `simulationRuntime.ts` runs a per-sim 200ms tick advancing `SimState` with geodesic math (`geolib`/`@turf/turf`).
- `/ws/sims` streams `Simulation[]`; `/ws/sims/:id` streams a single `Simulation` per tick.
- Frontend `src/simulationsService.ts` is the single source of live state: one WebSocket, kept in Solid stores via
  `reconcile` (keyed on `config.id`), plus a non-reactive `latestSimulations` snapshot and a listener registry for
  non-Solid consumers.
- `src/map/simulationMap.ts` is imperative MapLibre code living *outside* Solid's reactivity — it subscribes via that
  listener registry and writes back through the Hono client on marker drag.

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

Routing is filesystem-based (`filesystem-routing` + `@solidjs/router`) over `src/routes`, with no `index.html` and no
mount file: `@solidjs/vite-plugin`'s turnkey mode (`start: true`) generates entries around `src/App.tsx` and
`src/Document.tsx`. Styling is Tailwind 4 + DaisyUI.

## Env vars

Server: `PORT` (4000), `NODE_ENV` (`development` enables CORS for `:3000`), `STORAGE_DIR` (`./data/storage`),
`MAPTILER_KEY` (required for the map proxy).
Frontend: `VITE_MAP_STYLE` (MapLibre style URL; see `.env.development` / `.env.production`).

## Release

- Docker: `Dockerfile` must be built with the **repo root as context**. Pushes to `main` publish
  `ghcr.io/<owner>/sensor-sim` via `.github/workflows/publish.yml`; `docker-compose/sensor-sim/compose.yml` runs it with
  a volume at `/app/data/storage`.
