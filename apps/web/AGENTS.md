# apps/web

SolidStart fullstack app (`@sensor-sim/frontend`). Manages simulations and displays live positions on a map.

## Key dependencies

- **SolidJS / SolidStart** — UI framework and SSR
- **MapLibre GL** — interactive map rendering
- **tRPC client** — typed communication with `apps/server`
- **Tailwind CSS + DaisyUI** — styling

## Map proxy (`src/routes/api/maptiler/[...path].ts`)

Proxies MapTiler tile requests server-side to keep the API key out of the browser.

## Environment variables

| Variable       | Default      | Purpose          |
|----------------|--------------|------------------|
| `MAPTILER_KEY` | **Required** | MapTiler API key |

## Dev & build

```bash
pnpm dev      # vite dev server
pnpm build    # vite build
pnpm start    # vite start (production)
```

Requires Node ≥ 22.
