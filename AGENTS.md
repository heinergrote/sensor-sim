# sensor-sim

GPS simulation monorepo. Simulations move along routes or in circles and broadcast their position in real time.

## Structure

```
apps/server   – simulation engine with tRPC, WebSocket, and REST endpoints → apps/server/AGENTS.md
apps/web      – SolidStart management UI and map proxy                      → apps/web/AGENTS.md
packages/shared – shared TypeScript types (SimState, etc.)
```

## Workspace

pnpm workspaces. Run everything from the root:

```bash
pnpm dev            # start all apps in parallel
pnpm dev:server     # server only
pnpm dev:frontend   # web only
```
