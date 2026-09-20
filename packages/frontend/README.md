# @sensor-sim/frontend

SolidJS 2.x management UI for sensor-sim. Log in, create and control
simulations, watch their positions move live on a map, and administer user
accounts.

## Quick start

From the repo root (`pnpm dev` starts this and the server together), or here:

```bash
pnpm dev        # vite dev server on http://localhost:3000
pnpm build      # static build → dist/client, then typecheck
pnpm serve      # preview the production build
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest (jsdom)
pnpm lint       # oxlint src
```

In development this app expects `@sensor-sim/server` to be running on
`http://localhost:4000`. In production it is built to `dist/client` and served
by that same server from the same origin — `vite build` emits a purely static
site with no server dependencies of its own.

Everything except the home page needs a login. Sign in with the admin account
the server seeds on first start (`DEFAULT_ADMIN_USERNAME` /
`DEFAULT_ADMIN_PASSWORD`), then add further users under **Users** — only admins
may do that; other accounts can still drive the simulations.

## Key dependencies

- **SolidJS 2.0** — UI framework (client-only; SSR is one boolean away, see below)
- **@solidjs/router** — filesystem routing plus the `query`/`action` data APIs
- **MapLibre GL** — interactive map rendering
- **ky** — REST calls to `@sensor-sim/server` (`src/api.ts`); response/body types are imported separately from
  `@sensor-sim/server`'s source
- **Tailwind CSS 4 + DaisyUI**, **solid-icons** — styling and icons
- **oxlint** (with `eslint-plugin-solid`'s v2 config) — linting

## Environment variables

| Variable         | Default                                            | Purpose                 |
|------------------|----------------------------------------------------|-------------------------|
| `VITE_MAP_STYLE` | `<origin>/api/maptiler/maps/streets-v2/style.json` | URL of a MapLibre style |

`.env.development` points at the dev server's proxy on `:4000`;
`.env.production` is empty on purpose, so production falls back to the server's
MapTiler proxy on its own origin. Either way the MapTiler API key stays
server-side.

## Pages

Routing is filesystem-based over `src/routes`:

| Route         | Module            | What it does                                       |
|---------------|-------------------|----------------------------------------------------|
| `/`           | `index.tsx`       | Login form, or "logged in as …" once authenticated |
| `/control`    | `control.tsx`     | The simulation workspace: sim list + live map      |
| `/users`      | `users/index.tsx` | User list with an inline add form (admin only)     |
| `/users/:id`  | `users/[id].tsx`  | Edit or delete one user                            |
| anything else | `[...404].tsx`    | Not found                                          |

`src/router.ts` exports typed `paths` helpers (`paths()`, `paths.control()`,
`paths.users(id)`) — use those rather than hand-written URLs.

## Authentication

`src/auth.ts` holds the whole client-side auth state in one module-level signal
backed by `localStorage["jwt_token"]`, exposed through `useAuth()` as
`{token, login, logout, user}`. `user` is an async memo over `GET /api/me`; a
rejected token logs out automatically.

The token reaches the server three ways:

- `src/api.ts` (a `ky.extend`) sets `Authorization: Bearer …` on every REST
  call — the header comes from a hook, so it always reads the current token.
- `simulationMap.ts` attaches the same header via MapLibre's
  `transformRequest`, because the server's `/api/maptiler` proxy is
  authenticated too.
- The per-sim and status WebSockets carry it as a `?token=` query param
  instead — a browser `WebSocket` can't set the header itself. The one
  WebSocket that carries no token at all is a shared simulation's public link
  (`/api/shared/:token/ws`), gated by the share token in the path instead.

## How data flows

There are deliberately two patterns:

**Simulations — REST list, REST per-sim config, map-only live push.** `src/service/simulations.service.ts` exposes
`fetchSimulations`, a router `query()` over `GET /api/sims` — a plain REST fetch, not a push — and
`fetchSimulation(id)`, the same but for one sim's config (used by `SimDetails.tsx`; it doesn't auto-revalidate).
Alongside it, one module-level `WebSocket` to `/api/status/ws` keeps a small `status` store
(`{startedAt, simListUpdatedAt, numSims}`) up to date and calls `revalidate("simulations")` whenever
`simListUpdatedAt` moves, so the list refetches when someone creates or deletes a sim. Live per-sim position is
separate and now only consumed by the map: `src/service/simulation.service.ts`'s `addSimulationListener(id, cb)`
lazily opens one `WebSocket` per sim id against `/api/sims/:id/ws`, ref-counted so it closes once nothing is
listening. Components never poll: **lists/config come from queries, the map's live state comes from a per-sim
listener, writes go over REST** (`createSim`, `updateSim`, `updateCurrent`, `startSim`, `stopSim`, `deleteSim`,
`share`, `unShare`, …).

**Users — plain REST.** `src/service/users.service.ts` wraps the endpoints in
`@solidjs/router` `query()` / `action()`, so the router handles caching,
preloading (`users/[id].tsx` preloads on navigation) and revalidation after a
form submits.

Both go through `api = ky.extend({baseUrl: serverUrl, prefix: "/api"})` from
`src/api.ts` — there's no typed RPC client, just REST calls whose response
shapes are cast to types imported separately from `@sensor-sim/server`.
`src/components/control/simulationMap.ts` is imperative MapLibre code
deliberately outside Solid's reactivity: it subscribes through the same
per-sim listener registry as `SimDetails.tsx` and posts config /
`updateCurrent` changes when a marker is dragged.

Because those types are imported from the server's *source*, changing a
server Zod schema or database column changes this package's data types
immediately, no rebuild step in between — but a renamed or moved route is no
longer caught by the compiler, only by calling it.

## Sharing a simulation

Any simulation's owner can share it without giving out a login: **Share** on
its card (`SimDetails.tsx`) calls the `share` action (`POST
/api/sims/:id/share`), which returns a token good for 7 days and displays it
next to a copy-to-clipboard button; **Unshare** (`unShare` → `POST
/api/sims/:id/unshare`) revokes it immediately. The resulting link isn't
served by this frontend — it's the server's public `GET
/api/shared/:token`/`/ws` endpoints, meant for a device or script that
shouldn't need an account.

## Project shape

There is no `index.html` and no mount file. `@solidjs/vite-plugin`'s turnkey
mode (`start: true` in `vite.config.ts`) generates the entries around two
conventions:

- **`src/App.tsx`** — the app: router, nav, and the `Errored`/`Loading`
  boundaries the pages rely on.
- **`src/Document.tsx`** — the document shell, i.e. the new `index.html`.
  Site-wide head tags go here; it compiles only into the prerendered static
  shell and adds zero client-side JS. Per-page tags (`<Title>` from
  `@solidjs/meta`) live in the route modules.

`fileRoutes()` (from `filesystem-routing/vite`) scans `src/routes` and exposes
it as the `virtual:file-routes` module, which `@solidjs/router/fs` turns into
routes. `index.tsx` is `/`, `[...404].tsx` catches everything else, and pairing
`foo.tsx` with a `foo/` directory makes it a layout. A module is a page only if
it has a default export. Every route is code-split automatically, and
`file-routes.d.ts` is regenerated on each route change — don't edit it by hand.

To switch on streaming SSR, add `ssr: true` next to `start: true` in
`vite.config.ts`; `App.tsx`, `Document.tsx` and the routes carry over unchanged (`<HydrationScript />` is already in the
Document). Note that `src/auth.ts` reads `localStorage` at module scope, so it
would need guarding first.

## Testing

`vitest` runs component tests in jsdom via `@solidjs/testing-library` — add
`*.test.tsx` files next to what they test. Note that Solid 2.0 batches DOM
updates, so tests must `flush()` after firing events before asserting on the
DOM.

`@solidjs/diagnostics` is available for reactivity debugging — see
[CLAUDE.md](CLAUDE.md) for how to capture evidence instead of guessing.

## Notes for contributors

Solid is **not** React: components run once, there is no re-render, and
reactivity is fine-grained through signals. Don't port React patterns. See
[CLAUDE.md](CLAUDE.md) for the details that matter most when changing this
package.
