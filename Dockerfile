# Build context must be the repository root.
#
# Build a specific target:
#   docker build --target server -t sensor-sim-server .
#   docker build --target web    -t sensor-sim-web .

# ── deps ──────────────────────────────────────────────────────────────────────
# Shared install layer. apps/web imports AppRouter types from apps/server at
# build time, so all manifests are needed here regardless of target.
FROM node:24-slim AS deps
RUN corepack enable pnpm
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json      ./packages/server/
COPY packages/frontend/package.json    ./packages/frontend/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────────────────
# Builds all apps in parallel via the root "build" script (pnpm --parallel -r build).
FROM deps AS build
COPY packages/server      ./packages/server
COPY packages/frontend      ./packages/frontend

RUN pnpm build

# ── deploy-server ─────────────────────────────────────────────────────────────
# pnpm deploy produces a self-contained folder with only production node_modules.
# package.json#files whitelist ensures only dist/ is copied (not src/).
FROM build AS deploy-server

RUN pnpm --filter @sensor-sim/server deploy --prod /deploy

# ── server (runtime) ──────────────────────────────────────────────────────────
FROM node:24-slim AS server
WORKDIR /app

COPY --from=deploy-server /deploy ./

EXPOSE 4000 4001 4002

ENV TRCP_PORT=4000
ENV WS_PORT=4001
ENV REST_PORT=4002

CMD ["node", "dist/index.js"]

# ── web (runtime) ─────────────────────────────────────────────────────────────
# The Nitro/SolidStart .output directory is fully self-contained — no node_modules needed.
FROM node:24-slim AS web
WORKDIR /app

COPY --from=build /repo/packages/frontend/.output ./

EXPOSE 3000

ENV PORT=3000

# Configure at runtime:
# ENV MAPTILER_KEY=your_key_here

CMD ["node", "server/index.mjs"]
