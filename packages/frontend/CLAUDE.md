# Agent Guide

This is a SolidJS 2.x project. Solid is not React: components run once (there is no re-render), reactivity is
fine-grained through signals, and effects/memos have Solid-specific semantics. Do not port React patterns.

## Architecture

Single-page Solid app (`@sensor-sim/frontend`) that logs in against `@sensor-sim/server`, visualizes and controls
simulations, and administers users. In dev it runs on Vite (default `:3000`) against the server on `:4000`; in
production it's built to `dist/client` and served by the server itself from the same origin.

- `src/App.tsx` / `src/Document.tsx` — app shell: `Router`, page `<Title>`, `Nav`, `Errored`/`Loading` boundaries, and
  the HTML document wrapper.
- `src/router.ts` — `createRouter({routes: fileRoutes(pageRoutes)})`; exports `Router` and the typed `paths` helpers
  (`paths()`, `paths.control()`, `paths.users(id)`) used for every link and `navigate()` call.
- `src/routes/` — the pages (filesystem routing): `index.tsx` (home; login form when logged out), `control.tsx`
  (`SimControl`), `users/index.tsx` (list + add form), `users/[id].tsx` (detail, `int` match filter + `preload`),
  `[...404].tsx`. `file-routes.d.ts` at the package root is generated — never edit it.
- `src/auth.ts` — the auth store: one **module-level** signal seeded from `localStorage["jwt_token"]`. `useAuth()`
  returns `{token, login, logout, user}`; `user` is an async `createMemo` that calls `GET /api/me` (via its own `ky`
  instance, not `src/api.ts`'s) and logs out on a non-OK response. Because the signal is module-level, every
  `useAuth()` caller shares the same state.
- `src/api.ts` — `api = ky.extend({baseUrl: serverUrl, prefix: "/api", hooks: {beforeRequest: [...]}})`, with
  `serverUrl` = `http://localhost:4000` in dev, `window.location.origin` in prod. The `beforeRequest` hook re-reads
  the token signal per request, so login/logout takes effect without rebuilding the client. There is no typed RPC
  client any more (`hc<AppType>`/`honoClient` are gone) — every service module calls `api.get/post/put/delete(path)`
  against a plain path string and casts the JSON response to a type imported from `@sensor-sim/server`.
- `src/components/Nav.tsx` — top nav; Control/Users links and the username + logout button render only when `user()`
  resolves.
- `src/components/LoginForm.tsx` — posts to `/login` via `api`, stores the token via `login()`, navigates to Control.
- `src/components/users/` — `UserList` / `UserAddForm` / `UserDetail`, all typed on `Omit<User, "password">` (`User`
  comes from `@sensor-sim/server`, derived from the Drizzle schema).
- `src/service/users.service.ts` — user data access as `@solidjs/router` `query()`/`action()` around `api`:
  `fetchUsers`, `fetchUser`, `addUser`, `updateUser`, `deleteUser`. **Different pattern from sims:** these are
  ordinary REST reads with router-managed caching/revalidation, driven by form `action=` submissions.
- `src/components/control/SimControl.tsx` — main layout: `SimList` (sidebar) + `SimMap` (main pane).
- `src/components/control/SimList.tsx` — create-sim form (id/type) plus a list of sim rows, each rendering a
  `SimDetails`. Reads the sim list from `fetchSimulations()` (a router `query()`, not a store).
- `src/components/control/SimDetails.tsx` — per-sim control card. Reads that one sim's config via
  `fetchSimulation(id)` (a router `query()`, not a live socket) from `simulations.service.ts`; shows config (type,
  target, distance/azimuth, speed) and the share token; no longer shows live position, since that query doesn't
  auto-revalidate. start/stop/delete/share/unshare buttons call the `@solidjs/router` actions, also from
  `simulations.service.ts`.
- `src/components/control/SimMap.tsx` — mounts a MapLibre instance via `createSimulationMap(el, token())` on an element
  ref; disposes it on unmount.
- `src/components/control/simulationMap.ts` — imperative MapLibre wrapper (outside Solid's reactivity). Tracks one
  target marker + one current-position marker per sim, subscribes per sim via `addSimulationListener` (same registry
  `SimDetails.tsx` uses), and posts config / `updateCurrent` changes on marker drag through the `@solidjs/router`
  actions. It also passes the JWT: `transformRequest` attaches `Authorization: Bearer …` to every request whose
  origin matches the map style's, because the server's `/api/maptiler` proxy sits behind the JWT middleware. The
  token is read **once**, at map creation.
- `src/service/simulation.service.ts` — live per-sim state. `addSimulationListener(id, listener)` lazily opens (and
  ref-counts) one `WebSocket` per sim id against `${serverUrl}/api/sims/:id/ws?token=...` — the token travels as a
  query param because a `WebSocket` can't set headers — and closes it once the last listener for that id
  unsubscribes. There is no Solid store here; it's a plain listener registry, now subscribed to only by
  `simulationMap.ts` (`SimDetails.tsx` switched to the `fetchSimulation` REST query instead).
- `src/service/simulations.service.ts` — the sim *list*, a single-sim fetch, and mutations:
    - `fetchSimulations` is a router `query()` over `GET /sims` (cache key `"simulations"`) — a plain REST fetch, not
      a push.
    - `fetchSimulation(id)` is a router `query()` over `GET /sims/:id` (cache key `"simulation"`) — a one-shot
      config snapshot for `SimDetails.tsx`; nothing revalidates it automatically.
    - One module-level `WebSocket` to `${serverUrl}/api/status/ws?token=...` keeps a `status` store
      (`{startedAt, simListUpdatedAt, numSims}`) in sync, and calls `revalidate("simulations")` whenever
      `simListUpdatedAt` advances — that's what makes `fetchSimulations()` reflect a sim someone else just created or
      deleted (this does not revalidate `fetchSimulation`).
    - Exposes the mutation actions (`addSim`, `updateSim`, `deleteSim`, `startSim`, `stopSim`, `updateType`,
      `updateSpeed`, `updateCurrent`, `share`, `unShare`) as `@solidjs/router` `action()`s around `api`.
- For simulations: the list and a sim's config come from router `query()`s (list refreshed on the status signal, a
  single sim not auto-refreshed); only `simulationMap.ts`'s markers still track *live* position, via the per-sim
  WebSocket listener registry — no full-list push socket and no Solid store for sim state any more. For users it's
  plain REST reads via router queries, unchanged.

Server types (`Simulation`, `SimConfig`, `Status`, `User`, `Profile`) are imported from `@sensor-sim/server`'s
**source**, so a Zod schema or Drizzle column change on the server shows up here with no build step in between — but
since there's no typed RPC client any more, a renamed *route* is caught only by calling it, not by `tsc`.

## Env vars

- `VITE_MAP_STYLE` — MapLibre style URL (see `.env.development` / `.env.production`); falls back to
  `<origin>/api/maptiler/maps/streets-v2/style.json`

## Versioned skills (in node_modules — read on demand)

The installed packages ship agent skills that match their exact installed versions:

- `node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md` — repair guide mapping every dev-mode diagnostic code
  (e.g. `REACTIVE_WRITE_IN_OWNED_SCOPE`, `STRICT_READ_UNTRACKED`) to its prescribed fix. Read it whenever a Solid
  diagnostic code appears in test output or the browser console.
- `node_modules/@solidjs/diagnostics/skills/agent-loops/SKILL.md` — how to capture reactive evidence (which scopes
  re-ran and why, wasted recomputes, cost tables) and assert budgets, in tests and against live pages.

## Reactive diagnostics — capture evidence instead of guessing

Use these whenever you are debugging reactivity (something doesn't update, updates too often, or is slow) or verifying a
change didn't regress update granularity:

- **In tests:** `captureArtifact()` from `@solidjs/diagnostics` wraps a scenario and returns a serializable artifact of
  diagnostics + rerun attribution; matchers from `@solidjs/diagnostics/vitest` (`toHaveNoDiagnostics`,
  `toStayWithinRerunBudget`, `toHaveNoWaste`, …) assert on it. No browser needed.
- **Against the running dev server** (`diagnostics: true` in vite.config.ts; dev-only, no-op in builds). Requires an
  open page connected to the dev server (e.g. via a browser tool):
    - `GET /__solid/diagnostics` — status and connected client count
    - `POST /__solid/diagnostics` with JSON `{"method":"begin"}` then `{"method":"end"}` — capture a session into an
      artifact
    - `{"method":"whyDidRun","params":{"name":"<scope name>"}}` — recorded re-runs of one named scope in the open
      session
    - `{"method":"costs"}` — running cost tables for the open session

Name your signals/memos/effects (the `{ name: "..." }` option) — attribution reports scopes by name.
