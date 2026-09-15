# @sensor-sim/frontend

SolidJS 2.x management UI for sensor-sim. Create and control simulations, and
watch their positions move live on a map.

## Quick start

From the repo root (`pnpm dev` starts this and the server together), or here:

```bash
pnpm dev      # vite dev server on http://localhost:3000
pnpm build    # static build → dist/client
pnpm serve    # preview the production build
pnpm test     # vitest (jsdom)
pnpm lint     # oxlint src
```

In development this app expects `@sensor-sim/server` to be running on
`http://localhost:4000`. In production it is built to `dist/client` and served
by that same server from the same origin — `vite build` emits a purely static
site with no server dependencies of its own.

## Key dependencies

- **SolidJS 2.0** — UI framework (client-only; SSR is one boolean away, see below)
- **MapLibre GL** — interactive map rendering
- **Hono client** — typed REST calls to `@sensor-sim/server` via `hc<AppType>`
- **Tailwind CSS 4 + DaisyUI** — styling
- **oxlint** (with `eslint-plugin-solid`'s v2 config) — linting

## Environment variables

| Variable         | Default                                            | Purpose                 |
|------------------|----------------------------------------------------|-------------------------|
| `VITE_MAP_STYLE` | `<origin>/api/maptiler/maps/streets-v2/style.json` | URL of a MapLibre style |

`.env.development` points at the dev server's proxy on `:4000`;
`.env.production` is empty on purpose, so production falls back to the server's
MapTiler proxy on its own origin. Either way the MapTiler API key stays
server-side.

## How data flows

- `src/service/simulations.service.ts` is the single source of live state. It opens **one**
  WebSocket to `/ws/sims` and reconciles every message into Solid stores (`simulations`, `simulationIds`), keyed by
  `config.id`. It also keeps a plain
  non-reactive `latestSimulations` snapshot plus a listener registry for
  consumers that live outside Solid's reactivity.
- The same module exports `honoClient = hc<AppType>(serverUrl)`, where `AppType`
  is imported from `@sensor-sim/server`. All mutations (`create`, `start`,
  `stop`, `delete`, `updateTarget`, `updateCurrent`) go through it.
- Components never poll and never fetch state: **reads come from the stores,
  writes go over REST.**
- `src/components/control/simulationMap.ts` is imperative MapLibre code deliberately outside
  Solid's reactivity. It subscribes through the listener registry and posts
  `updateTarget` / `updateCurrent` when a marker is dragged.

Because `AppType` is imported from the server's *source*, changing a server
route or Zod schema changes this package's types immediately — no rebuild step
in between.

## Project shape

There is no `index.html` and no mount file. `@solidjs/vite-plugin`'s turnkey
mode (`start: true` in `vite.config.ts`) generates the entries around two
conventions:

- **`src/App.tsx`** — the app, router included.
- **`src/Document.tsx`** — the document shell, i.e. the new `index.html`.
  Site-wide head tags go here; it compiles only into the prerendered static
  shell and adds zero client-side JS. Per-page tags (`<Title>` from
  `@solidjs/meta`) live in the route modules.

Routing is filesystem-based: `fileRoutes()` (from `filesystem-routing/vite`)
scans `src/routes` and exposes it as the `virtual:file-routes` module, which
`@solidjs/router/fs` turns into routes. `index.tsx` is `/`, `[...404].tsx`
catches everything else, and pairing `foo.tsx` with a `foo/` directory makes it
a layout. A module is a page only if it has a default export. Every route is
code-split automatically.

To switch on streaming SSR, add `ssr: true` next to `start: true` in
`vite.config.ts`; `App.tsx`, `Document.tsx` and the routes carry over unchanged (`<HydrationScript />` is already in the
Document).

## Testing

`vitest` runs component tests in jsdom via `@solidjs/testing-library` — add
`*.test.tsx` files next to what they test. Note that Solid 2.0 batches DOM
updates, so tests must `flush()` after firing events before asserting on the
DOM.

`@solidjs/diagnostics` is available for reactivity debugging — see
[AGENTS.md](./AGENTS.md) for how to capture evidence instead of guessing.

## Notes for contributors

Solid is **not** React: components run once, there is no re-render, and
reactivity is fine-grained through signals. Don't port React patterns. See
[AGENTS.md](./AGENTS.md) for the details that matter most when changing this
package.
