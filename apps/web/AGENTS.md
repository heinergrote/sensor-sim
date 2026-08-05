# apps/web

SolidStart fullstack app (`@sensor-sim/frontend`). Manages simulations and displays live positions on a map.

## Key dependencies

- **SolidJS / SolidStart** — UI framework and SSR
- **MapLibre GL** — interactive map rendering
- **tRPC client** — typed communication with `apps/server`
- **Tailwind CSS + DaisyUI** — styling

## tRPC client (`src/trpcClient.ts`)

Splits traffic automatically:
- Subscriptions → WebSocket (`TRCP_WS_URL`, default `ws://localhost:4001`)
- Queries/mutations → HTTP (`TRCP_HTTP_URL`, default `http://localhost:4000`)

## Map proxy (`src/routes/api/maptiler/[...path].ts`)

Proxies MapTiler tile requests server-side to keep the API key out of the browser.

## Environment variables

| Variable        | Default                  | Purpose                   |
|-----------------|--------------------------|---------------------------|
| `TRCP_HTTP_URL` | `http://localhost:4000`  | tRPC HTTP endpoint        |
| `TRCP_WS_URL`   | `ws://localhost:4001`    | tRPC WebSocket endpoint   |

## Dev & build

```bash
pnpm dev      # vite dev server
pnpm build    # vite build
pnpm start    # vite start (production)
```

Requires Node ≥ 22.
