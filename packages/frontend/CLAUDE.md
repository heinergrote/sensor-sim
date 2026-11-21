# packages/frontend — Agent Guide

SolidJS 2.x, **not React**: components run once (no re-render), reactivity is fine-grained signals, effects/memos
have Solid-specific semantics. Don't port React patterns.

## Commands (run here, or `pnpm --filter @sensor-sim/frontend <script>` from root)

```bash
pnpm dev                       # vite on :3000 (expects server on :4000)
pnpm build                     # vite build → dist/client, then typecheck
pnpm serve                     # preview the build
pnpm typecheck                 # tsc --noEmit
pnpm test                      # vitest (jsdom); single file: pnpm test src/foo.test.tsx — no test files yet
pnpm lint                      # oxlint src
```

## Architecture

- `src/App.tsx` / `src/Document.tsx` — app shell and HTML document. The **only `Loading` boundary** wraps the whole
  shell (`Nav` + `main`) in `App.tsx`; pages and `Nav` don't add their own. The `Errored` boundary is commented out. No `index.html`/mount file: `@solidjs/vite-plugin` turnkey mode (`start: true`)
  generates entries.
- `src/routes.ts` — the explicit route tree (`defineRoutes`): `/`, `/sims/:id?`, `/users`, `/users/:id`, `*404`.
  Every page is a `lazy(() => import(...))` chunk under `src/pages/`.
- `src/pages/<area>/<area>.route.ts` — `defineRoute({path, matchFilters: {id: int}, preload?})` **without**
  `component`; `routes.ts` adds it as `defineRoute({...simsRoute, component: Sims})`. The page reads `props.params`
  via `RouteProps<typeof simsRoute.path>` with an `import type`; params arrive as strings → `Number(...)`.
  **A `*.route.ts` must never import its page** (pulls it into the main chunk). Typing a page from `Router.paths.*`
  causes TS2502 (circular).
- `src/router.ts` — `createRouter({routes, preloadLinks: intentPreload()})`; typed `paths` (`paths()`,
  `paths.sims(id?)`, `paths.users(id)`) — use them for links.
- `src/auth.ts` — access token / expiry / refresh token in localStorage (`jwt_token`, `jwt_expires_at`,
  `refresh_token`). A `session` signal changes **only on login/logout** (also other tabs, via `storage` events) —
  token rotation is deliberately not reactive, or `user` and the status socket would re-run every 15 min.
  `getValidToken()` refreshes if < 60 s left; `refreshTokens(stale)` is single-flight per tab and runs under
  `navigator.locks` across tabs (re-reads storage under the lock — two tabs presenting the same refresh token
  would trip the server's reuse detection and kill the session). A 401 from refresh logs out; a network error
  doesn't. A timer refreshes ahead of expiry while logged in. `useAuth()` → `{login, logout, user}`, `user` =
  async memo over `GET /api/me`.
- `src/api.ts` — `api = ky.extend({baseUrl: serverUrl, prefix: "/api"})`; `beforeRequest` sets
  `await getValidToken()`, `afterResponse` refreshes once and retries (`ky.retry`) on a 401. Both sockets call
  `getValidToken()` before every (re)connect. `serverUrl` = `http://localhost:4000` in dev, `window.location.origin` in prod.

### Sim configs: optimistic store + revision signal

- `src/service/configs.service.ts` — `useSimConfigsApi()` returns a lazily created **module singleton**:
  `configs` (a `createOptimisticStore` over `GET /configs`), `revision()` (its `X-Config-Revision`),
  `refreshConfigs()`, and core solid-js `action(function* …)`s: `add(label)`, `remove(id)`, `startStop(id, playing)`,
  `share(id, share)`, `update(id, UpdateSimConfig)` (PATCH; spec edits send the **whole** spec), `updateType(id,
  SpecType | null)` (`PUT /configs/:id/type`, or `PATCH {spec: null}`). Each writes the store optimistically (or
  marks it pending with `affects`), awaits the request, then `refresh(configs)`. Call actions directly from handlers.
- **No auto-revalidation on remote changes.** `components/RevisionStatus.tsx` (in `Nav`) owns the `/api/status/ws`
  socket: it stores `{configsRevision}` in `statusConfigsRevision`; when that exceeds `api.revision()` it shows a
  refresh button. Its icon turns red while disconnected.
- Don't `deep()`/`snapshot()` rows of the configs store (froze the tab on rc.21); copy fields by plain reads instead.
- `src/service/simulation.service.ts` — live `SimData` only. `addSimulationListener(id, cb)` lazily opens one
  ref-counted WebSocket per sim (`/api/sims/:id/ws?token=`) and returns an unsubscribe.
- **Both sockets reconnect** on a server-side close with exponential backoff (1 s → 30 s). A close is ignored when
  the socket is no longer the registered one — intentional closes must deregister *before* calling `close()`.

### Sims page and map

- `pages/sims/Sims.tsx` — selection lives in the URL. The selected config is derived from `api.configs` (no separate
  fetch); if the id isn't in the list, an effect redirects to `/sims` (`replace`). Renders
  `components/sims/SimList.tsx`: `SimForm` + a DaisyUI `list` of rows (id button, label, type; clicking toggles
  `/sims` ↔ `/sims/:id`) beside `SimDetails`.
- `SimDetails.tsx` — the selected sim's `SimCard` above the map. Provides **`MapContext`** (`editors/mapContext.ts`,
  an accessor of the loaded `MapLibreMap | undefined`). Creates the map in `onSettled` inside a
  `requestAnimationFrame` (MapLibre setup is >10 ms sync → `HOT_SCOPE_TIME`). Its effect tracks just `simConfig?.id`
  → `simulationMap.attachSim(id)`, so spec edits never resubscribe the live socket. Cleanup defers `dispose()`
  (`map.remove()`) to a microtask: editors are disposed in the same pass and must detach from a live map. A map that
  loads after unmount is disposed.
- `simulationMap.ts` — imperative MapLibre wrapper outside Solid: map setup and the red current-position marker
  (← `SimData.position.{longitude,latitude}`). Resolves only after `load` (don't guard on `map.loaded()`, it's false
  while tiles load). MapLibre 6 (`MapLibreMap`): `setWorkerUrl` (blob of the raw worker in dev, `?worker&url` in
  prod), a missing-image resolver adding a transparent pixel, JWT via `transformRequest` (synchronous, reads the stored token per request — kept fresh by `auth.ts`'s timer).
- `SimCard.tsx` — only rendered for the selected sim. Two DaisyUI cards in a `flex-wrap gap-2` row: left (`grow`) =
  id/label, type `<select>` (→ `updateType`), Share/Unshare + copy (full URL) + token link (`target=_blank`), Delete
  with inline "Really?" confirm; right (`grow-999 basis-0`, only with a spec) = Play/Stop + `<SpecEditor config/>`.
  Either fills the row when alone on its line. The select keeps a **draft signal** (`createSignal(() => prop)`) so
  the binding doesn't write the old value back mid-request; reset on rejection. Labels (`sim-55`) are not ids.

### Spec editors (`components/sims/editors/`)

One Solid component per spec type, registered in `SpecEditor.tsx` (`specEditors: {[K in SpecType]: Component<…>}`
— a new type fails to compile until it has one). `SpecEditor` waits for the map from `MapContext` and mounts the
editor via `dynamic(() => specEditors[type])`. An editor gets `{configId, spec, updatedAt, map}` and owns:

- **its map objects**, added in `createEffect(() => props.map, map => {…; return cleanup})` and removed on cleanup
  (unmount = deselect, type change, other sim selected);
- **a draft** `createSignal(() => toDraft(props.spec))` — a **plain copy**, never the store's tuples (spreading a
  store proxy in an effect callback triggers `STRICT_READ_UNTRACKED`). It follows the spec after save/remote updates
  (unsaved edits are then dropped). Map events write the draft; a second effect moves the map objects to it;
- **its UI**: draft values, Reset/Save (enabled while dirty). Save → `api.update(id, {spec: {...props.spec,
  ...draft()}})`. Nothing saves on drag.
- **Signal writes commit on the next flush**: `setDraft(x); draft()` still returns the old value — pass `x` along
  (e.g. `save(position)`) instead of reading it back in the same handler.

Types: `FixedEditor` (the exception: **no draft/UI**, blue marker saves `position` on `dragend` and follows
`props.spec`); `OrbitEditor` (blue center moves the whole orbit, green start sets
`radius`/`startAngle` via `@sensor-sim/shared/geoUtils`; `speed` slider is part of the draft); `PathEditor`
(plain **Terra Draw** + `TerraDrawMapLibreGLAdapter`, no UI control: modes `select` (default; drag line/vertices,
midpoints, delete vertices), `linestring`, `freehand-linestring` via the card's two **New** buttons; a `finish` event
sets `waypoints`; the drawn line starts selected; the draft follows a `saved` memo that copies the spec
**untracked**, keyed on the spec object + `updatedAt` (tracking every waypoint tuple made hundreds of sources), and
**Undo** resets to it; redraws only if the draft differs from what's drawn; coordinates
rounded to 9 significant digits for terra draw; shows length via `pathLength`; Save needs ≥ 2 waypoints; `speed` in
the draft). Its cleanup calls `terraDraw.stop()` only if the map hasn't fired `remove` — after `map.remove()` the
adapter's `clear()` crashes on the missing sources. Coordinates are `[lng, lat]`; `getLngLat().toArray()` yields
that, spread tuples (`[...pos]`) into `setLngLat` (readonly).

### Users

`src/service/users.service.ts` — `fetchUsers`, `fetchUser(id: number)` router `query()`s; `addUser(form)`,
`updateUser(id, form)`, `deleteUser(id)` plain async functions that `revalidate` both query keys themselves (the
router doesn't revalidate after plain fetches). Forms call them from `onSubmit` (with `preventDefault`), Delete from
`onClick`. Components in `components/users/` are typed on `User`.

**No router `formAction`s.** Without server functions they only render `action="https://action/<name>"` and resolve it
through a registry; a miss (e.g. a component-scoped action not registered yet) falls through to a native POST to that
URL. Use plain submit handlers calling service functions / core `action`s.

### Server types

Import DTO types from `@sensor-sim/shared` (`SimConfig`, `UpdateSimConfig`, `Spec`, `SpecType`,
`SpecFixed`/`SpecPath`/`SpecOrbit`, `SimData`, `GeoPosition`, `StatusMessage`, `User`, `Profile`). No dependency on
`@sensor-sim/server`. Shared ships **source**: schema changes break `tsc` here immediately, renamed routes don't.
Importing its Zod schemas pulls `zod` into the bundle.

## Env vars

`VITE_MAP_STYLE` — MapLibre style URL; falls back to `<origin>/api/tiles/style.json` (the server picks the
tile provider; the frontend doesn't know which). `transformRequest` adds the JWT to every request on the
style URL's origin (in dev `:4000`, not the page's `:3000`).

## Versioned skills (in node_modules — read on demand)

- `node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md` — maps every dev diagnostic code
  (`REACTIVE_WRITE_IN_OWNED_SCOPE`, `STRICT_READ_UNTRACKED`, …) to its fix. Read it whenever one appears.
- `node_modules/@solidjs/diagnostics/skills/agent-loops/SKILL.md` — capturing reactive evidence and asserting budgets.

## Reactive diagnostics — capture evidence instead of guessing

- **In tests:** `captureArtifact()` from `@solidjs/diagnostics`; matchers from `@solidjs/diagnostics/vitest`.
- **Against the dev server** (requires `diagnostics: true` in `vite.config.ts` — currently `false`): `GET
  /__solid/diagnostics`; `POST` `{"method":"begin"|"end"|"costs"}` or `{"method":"whyDidRun","params":{"name":…}}`.
- Without it: dev warnings land in the browser console; wrap `console.warn` to capture `new Error().stack` and find
  the offending effect.

Name signals/memos/effects (`{ name: "..." }`) — attribution reports scopes by name. Solid 2.0 batches DOM updates:
tests must `flush()` after firing events before asserting.
