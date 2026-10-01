# @sensor-sim/frontend

SolidJS 2.x management UI for sensor-sim: log in, create and control simulations, watch them move on a map, and
administer users.

## Quick start

From the repo root (`pnpm dev` starts this and the server), or here:

```bash
pnpm dev        # vite on http://localhost:3000
pnpm build      # static build → dist/client, then typecheck
pnpm serve      # preview the production build
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest (jsdom)
pnpm lint       # oxlint src
```

In dev it expects `@sensor-sim/server` on `http://localhost:4000`. In production the server serves `dist/client`
from its own origin. Log in with the admin the server's migrate step seeded; only admins can manage users.

## Key dependencies

- **SolidJS 2.0** + **@solidjs/router** (filesystem routing, `query`/`action` data APIs)
- **MapLibre GL 6** — map rendering; `@sensor-sim/shared/geoUtils` (turf) — distance/bearing when dragging markers
- **ky** — REST client (`src/api.ts`); response types come from `@sensor-sim/shared`
- **Tailwind CSS 4 + DaisyUI**, **solid-icons**; **oxlint** for linting

## Environment variables

| Variable         | Default                                            | Purpose                 |
|------------------|----------------------------------------------------|-------------------------|
| `VITE_MAP_STYLE` | `<origin>/api/maptiler/maps/streets-v2/style.json` | URL of a MapLibre style |

`.env.development` points at the dev server's proxy on `:4000`; `.env.production` is empty so production uses the
same-origin proxy. The MapTiler key never reaches the browser.

## Pages

| Route        | Module            | What it does                                 |
|--------------|-------------------|----------------------------------------------|
| `/`          | `index.tsx`       | Login form, or "logged in as …"              |
| `/control`   | `control.tsx`     | Simulation workspace: config list + live map |
| `/users`     | `users/index.tsx` | User list with add form (admin only)         |
| `/users/:id` | `users/[id].tsx`  | Edit or delete one user                      |
| other        | `[...404].tsx`    | Not found                                    |

Use the typed `paths` helpers from `src/router.ts` instead of hand-written URLs.

## Data flow

**Sim configs — REST + status signal.** `src/service/configs.service.ts` wraps `/api/configs` in router
`query()`/`action()`s (`fetchSimConfigs`, `addSimConfig`, `updateSimConfig`, `startSim`, `stopSim`, `share`, …). A
WebSocket to `/api/status/ws` revalidates `fetchSimConfigs` whenever the server reports a config change, so the list
and map stay in sync across clients.

**Live position — per-sim WebSocket.** `src/service/simulation.service.ts`'s `addSimulationListener(id, cb)` opens
one ref-counted socket per sim against `/api/sims/:id/ws` and delivers `SimData`. Only the map uses it.

Both the status socket and the per-sim sockets reconnect with backoff (1 s up to 30 s) when the server closes them,
e.g. on a backend restart, and the config list is refetched after the status socket reconnects.

**The map** (`components/control/simulationMap.ts`, imperative MapLibre outside Solid's reactivity) draws a target
marker from each config and a current-position marker from its live state. Dragging the target updates the config's
target; dragging the current marker recomputes `initialDistance`/`initialAzimuth` relative to the target and saves
those, which restarts the sim from there.

**Users — plain REST** via `src/service/users.service.ts` router queries/actions, driven by form submissions.

## Authentication

`src/auth.ts` keeps the token in one module-level signal backed by `localStorage["jwt_token"]`
(`useAuth()` → `{token, login, logout, user}`; `user` calls `GET /api/me` and logs out on rejection). The token is
sent as a bearer header by `ky` and by MapLibre's `transformRequest` (the tile proxy is authenticated), and as
`?token=` on WebSockets.

## Sharing a simulation

**Share** on a sim card calls `POST /api/configs/:id/share` and shows the 7-day token with a copy button; the unshare
button revokes it. The token unlocks the server's public `/api/shared/:token[/ws]` endpoints for devices without an
account.

## Project shape

No `index.html` or mount file: `@solidjs/vite-plugin` turnkey mode (`start: true`) generates entries around
`src/App.tsx` (router, nav, boundaries) and `src/Document.tsx` (document shell, site-wide head tags). `fileRoutes()`
scans `src/routes`; `foo.tsx` + `foo/` makes a layout, only default exports are pages, and `file-routes.d.ts` is
regenerated automatically. Streaming SSR is `ssr: true` in `vite.config.ts` away, but `src/auth.ts` reads
`localStorage` at module scope and would need guarding.

## Testing

Vitest + `@solidjs/testing-library` in jsdom; put `*.test.tsx` next to the code. Solid 2.0 batches DOM updates, so
call `flush()` after firing events. See [CLAUDE.md](CLAUDE.md) for `@solidjs/diagnostics` and other agent notes —
and remember Solid is **not** React.
