# sensor-sim

GPS simulation monorepo. Simulations move along routes or in circles and broadcast their position in real time.

## Structure

```
packages/server   – simulation engine (Hono) with REST and WebSocket endpoints, including map proxy → packages/server/AGENTS.md
packages/frontend – Solid JS V2 management UI → packages/frontend/AGENTS.md
```

## Workspace

pnpm workspaces. Run everything from the root:

```bash
pnpm dev            # start all apps in parallel
pnpm dev:server     # server only
pnpm dev:frontend   # web only
```
