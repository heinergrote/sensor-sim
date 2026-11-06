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
- `src/routes.ts` — the explicit route tree (`defineRoutes`): `/`, `/sims/:id?`, `/users`, `/users/:id`, `*404`.
  Every page is a `lazy(() => import(...))` chunk under `src/pages/`.
- `src/pages/<area>/<area>.route.ts` — `defineRoute({path, matchFilters: {id: int}, preload})` **without**
  `component`; `routes.ts` adds it as `defineRoute({...simsRoute, component: Sims})` (a plain object rejects
  components with required params). The page reads `props.params` via `RouteProps<typeof simsRoute.path>` (pass
  `.path`: `RouteProps` doesn't understand a `defineRoute` result) with an `import type`; params still arrive as
  strings → `Number(...)`. **A `*.route.ts` must never import its page:** `routes.ts` imports it statically, so that
  would pull the page into the main chunk and defeat `lazy()`. Typing a page from `Router.paths.*` causes TS2502
  (circular: `Router` → `routes` → page → props).
- `src/router.ts` — `createRouter({routes, preloadLinks: intentPreload()})`; typed `paths` (`paths()`,
  `paths.sims(id?)`, `paths.users(id)`) — use them for links.
- `src/auth.ts` — module-level token signal seeded from `localStorage["jwt_token"]`; `useAuth()` →
  `{token, login, logout, user}`, `user` = async memo over `GET /api/me`, logs out on failure.
- `src/api.ts` — `api = ky.extend({baseUrl: serverUrl, prefix: "/api"})`; a `beforeRequest` hook re-reads the token
  per request. `serverUrl` = `http://localhost:4000` in dev, `window.location.origin` in prod.

### Simulations: configs vs. live state

- `src/service/configs.service.ts` — everything config-side: `@solidjs/router` `query()`s; button-driven mutations
  are router `formAction()`s (bound via mini `<form method="post" action={x.with(id)} class="contents">` — a
  `FormAction` can't be called directly, its `this` must come from the router), code-driven ones (`updateSimConfig`,
  `updateType`) are core solid-js `action(async function* …)`s that `revalidate(fetchSimConfigs.key)` themselves:
  `fetchSimConfigs` (`GET /configs`, key `"simConfigs"`), `fetchSimConfig(id)`, and actions `addSimConfig` (form:
  `label` only — new configs have `spec: null`), `updateSimConfig(id, UpdateSimConfig)` (PATCH; spec edits send
  the **whole** spec), `deleteSimConfig`, `startSim`/`stopSim`, `updateType(id, SpecType | null)` (`PUT
  /configs/:id/type`, or `PATCH {spec: null}` for none), `share`, `unShare`. A module-level `createRoot` opens `/api/status/ws?token=` whenever
  `user()` changes and calls `revalidate(fetchSimConfigs.key)` on each newer `configUpdate` message.
- `src/service/simulation.service.ts` — live `SimData` only. `addSimulationListener(id, cb)` lazily opens one
  ref-counted WebSocket per sim (`/api/sims/:id/ws?token=`) and returns an unsubscribe. Plain listener registry, no
  store.
- **Both sockets reconnect** on a server-side close (backend restart, or sim deleted) with exponential backoff (1 s → 30
  s, reset on the next open/message). A close is ignored when the socket is no longer the registered one —
  so intentional closes (logout, last listener removed) must deregister *before* calling `close()`. The status
  socket revalidates the config list after a reconnect (updates may have been missed). A deleted sim's socket stops
  retrying once the revalidated list drops it and the page redirects, detaching its map listener.
- `pages/sims/Sims.tsx` — the selection lives in the URL. The selected config is **derived from
  `fetchSimConfigs()`** (no separate `fetchSimConfig` query), so status-socket revalidation keeps the map current. If
  the id isn't in the list (deleted here or remotely, or bogus), an effect redirects to `/sims` (`replace`). Renders
  `components/sims/SimList.tsx` (`SimForm` + one `SimCard` per config + `SimMap`).
- `SimCard.tsx` — config/share token and the actions; no live position. Play/Stop, Delete, Share/Unshare are
  `<form action={…with(id)}>` buttons. Type `<select>` (None/Fixed/Path/Orbit) → `updateType`; per-type spec
  summary via `<Switch>/<Match>` on `spec.type`; `SpeedSlider` for `path`/`orbit` (live label on `input`, PATCHes
  `{spec: {...spec, speed}}` on `change`). Select and slider keep a **draft signal** (`createSignal(() => prop)`)
  so the `selected`/`value` binding doesn't write the old value back mid-request; reset to the prop on rejection. **Select** toggles `/sims` ↔ `/sims/:id` (highlight via `useMatch`).
- `SimMap.tsx` — passes a copy of the selected config (or `null`) to `createSimulationMap(el, token).attachSimConfig`;
  copying makes the effect track every field. Only one sim is on the map at a time.
- `simulationMap.ts` — imperative MapLibre wrapper outside Solid reactivity. Every `attachSimConfig(cfg)` tears
  down the previous sim (live listener, current marker, spec renderer) and rebuilds; the current marker (← `SimData`,
  not draggable) is shared. Spec editing is delegated to a `ConfigSpecRenderer<T>` (`{updateSpec, dispose}`) picked
  by `spec.type`: `simulationFixed.ts` (one marker), `simulationPath.ts` (start + target), `simulationOrbit.ts`
  (center + start point; radius/`startAngle` recomputed via `@sensor-sim/shared/geoUtils`). On `dragend` a renderer
  emits a full new spec (`getLngLat().toArray()` → `[lng, lat]`; spread `[...pos]` back into `setLngLat`, the
  tuples are readonly) → `updateSimConfig`. The current marker reads `SimData.position.{longitude,latitude}`. No spec → no markers to edit. MapLibre 6 (`MapLibreMap` export): `setWorkerUrl` with a `?worker&url` import, and a missing-image resolver that
  adds a transparent pixel. JWT goes out via `transformRequest` (read once at map creation).

### Users

`src/service/users.service.ts` — `fetchUsers`, `fetchUser(id: number)` queries; `addUser`, `updateUser`, `deleteUser`
router `formAction()`s driven by form `action=` (`UserDetail` deletes via the button's `formaction={deleteUser.with(id)}`). Components in `components/users/` are typed on `User`.

### Server types

Import DTO types from `@sensor-sim/shared` (`SimConfig`, `UpdateSimConfig`, `Spec`, `SpecType`,
`SpecFixed`/`SpecPath`/`SpecOrbit`, `SimData`, `GeoPosition`, `StatusMessage`, `User`, `Profile`); the frontend has no dependency on `@sensor-sim/server`. The package ships
**source**, so schema changes break `tsc` here immediately — renamed routes don't. Its Zod schemas are importable
too (e.g. for client-side validation), but that pulls `zod` into the bundle.

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
