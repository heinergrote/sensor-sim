# packages/frontend — Agent Guide

SolidJS 2.x, **not React**: components run once (no re-render), reactivity is fine-grained signals, effects/memos
have Solid-specific semantics. Don't port React patterns.

## Commands (run here, or `pnpm --filter @sensor-sim/frontend <script>` from root)

```bash
pnpm dev                       # vite on :3000 (expects server on :4000)
pnpm build                     # vite build → dist/client, then typecheck
pnpm serve                     # preview the build
pnpm typecheck                 # tsc --noEmit
pnpm test                      # vitest (jsdom); single file: pnpm test src/foo.test.tsx
pnpm lint                      # oxlint src
```

## Architecture

- `src/App.tsx` / `src/Document.tsx` — app shell (`Router`, `Nav`, `Errored`/`Loading`) and HTML document. No
  `index.html`/mount file: `@solidjs/vite-plugin` turnkey mode (`start: true`) generates entries.
- `src/router.ts` — typed `paths` helpers (`paths()`, `paths.control()`, `paths.users(id)`); use them for all links.
- `src/routes/` — filesystem pages: `index.tsx`, `control.tsx`, `users/index.tsx`, `users/[id].tsx`,
  `[...404].tsx`. `file-routes.d.ts` is generated — never edit.
- `src/auth.ts` — module-level token signal seeded from `localStorage["jwt_token"]`; `useAuth()` →
  `{token, login, logout, user}`, `user` = async memo over `GET /api/me`, logs out on failure.
- `src/api.ts` — `api = ky.extend({baseUrl: serverUrl, prefix: "/api"})`; a `beforeRequest` hook re-reads the token
  per request. `serverUrl` = `http://localhost:4000` in dev, `window.location.origin` in prod.

### Simulations: configs vs. live state

- `src/service/configs.service.ts` — everything config-side, as `@solidjs/router` `query()`/`action()`:
  `fetchSimConfigs` (`GET /configs`, key `"simConfigs"`), `fetchSimConfig(id)`, and actions `addSimConfig` (form:
  `label`, `type`), `updateSimConfig(id, UpdateSimConfigDto)` (PATCH), `deleteSimConfig`, `startSim`/`stopSim`,
  `updateType`, `updateSpeed`, `share`, `unShare`. A module-level `createRoot` opens `/api/status/ws?token=` whenever
  `user()` changes and calls `revalidate(fetchSimConfigs.key)` on each newer `configUpdate` message.
- `src/service/simulation.service.ts` — live `SimData` only. `addSimulationListener(id, cb)` lazily opens one
  ref-counted WebSocket per sim (`/api/sims/:id/ws?token=`) and returns an unsubscribe. Plain listener registry, no
  store.
- **Both sockets reconnect** on a server-side close (backend restart, or sim deleted) with exponential backoff (1 s → 30
  s, reset on the next open/message). A close is ignored when the socket is no longer the registered one —
  so intentional closes (logout, last listener removed) must deregister *before* calling `close()`. The status
  socket revalidates the config list after a reconnect (updates may have been missed). A deleted sim's socket stops
  retrying once the revalidated config list drops its map listener — which depends on the status socket being up.
- `components/control/SimList.tsx` — create form + one card per `fetchSimConfigs()` entry; passes the config as a
  prop to `SimDetails.tsx` (no per-sim query). `SimDetails` shows config/share token and calls the actions; it shows
  no live position.
- `components/control/SimMap.tsx` — feeds `fetchSimConfigs()` into `createSimulationMap(el, token).updateSimConfigs`.
- `components/control/simulationMap.ts` — imperative MapLibre wrapper outside Solid reactivity, keyed by numeric id.
  Target marker ← config; current marker ← `SimData` via `addSimulationListener`. Dragging the target PATCHes
  `targetLatitude/Longitude`; dragging the current marker computes `initialDistance`/`initialAzimuth` from the target
  (`@sensor-sim/shared/geoUtils`) and PATCHes those — there is no `updateCurrent` endpoint. Uses MapLibre 6:
  `setWorkerUrl` with a
  `?worker&url` import, and a missing-image resolver that adds a transparent pixel. JWT goes out via
  `transformRequest` (read once at map creation).

### Users

`src/service/users.service.ts` — `fetchUsers`, `fetchUser`, `addUser`, `updateUser`, `deleteUser` as router
query/actions driven by form `action=`. Components in `components/users/` are typed on `User`.

### Server types

Import DTO types from `@sensor-sim/shared` (`SimConfig`, `UpdateSimConfig`, `SimData`, `GeoPosition`,
`StatusMessage`, `User`, `Profile`); the frontend has no dependency on `@sensor-sim/server`. The package ships
**source**, so schema changes break `tsc` here immediately — renamed routes don't. Its Zod schemas are importable
too (e.g. for client-side validation), but that pulls `zod` into the bundle.

`Nav.tsx` currently has a temporary "X" button that force-revalidates `fetchSimConfigs` (debug aid).

## Env vars

`VITE_MAP_STYLE` — MapLibre style URL; falls back to `<origin>/api/maptiler/maps/streets-v2/style.json`.

## Versioned skills (in node_modules — read on demand)

- `node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md` — maps every dev diagnostic code
  (`REACTIVE_WRITE_IN_OWNED_SCOPE`, `STRICT_READ_UNTRACKED`, …) to its fix. Read it whenever one appears.
- `node_modules/@solidjs/diagnostics/skills/agent-loops/SKILL.md` — capturing reactive evidence and asserting budgets.

## Reactive diagnostics — capture evidence instead of guessing

- **In tests:** `captureArtifact()` from `@solidjs/diagnostics`; matchers from `@solidjs/diagnostics/vitest`
  (`toHaveNoDiagnostics`, `toStayWithinRerunBudget`, `toHaveNoWaste`, …).
- **Against the dev server** (requires `diagnostics: true` in `vite.config.ts` — currently `false` — and an open
  page): `GET /__solid/diagnostics`; `POST` with `{"method":"begin"}` / `{"method":"end"}`,
  `{"method":"whyDidRun","params":{"name":"<scope>"}}`, `{"method":"costs"}`.

Name signals/memos/effects (`{ name: "..." }`) — attribution reports scopes by name.

Solid 2.0 batches DOM updates: tests must `flush()` after firing events before asserting.
