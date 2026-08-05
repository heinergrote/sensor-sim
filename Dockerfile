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

COPY packages/shared/package.json ./packages/shared/

COPY apps/server/package.json      ./apps/server/
COPY apps/web/package.json         ./apps/web/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────────────────
# Builds all apps in parallel via the root "build" script (pnpm --parallel -r build).
FROM deps AS build

COPY packages/shared/src     ./packages/shared/src

COPY apps/server/src         ./apps/server/src

COPY apps/web/src            ./apps/web/src
COPY apps/web/public         ./apps/web/public
COPY apps/web/vite.config.ts ./apps/web/
COPY apps/web/tsconfig.json  ./apps/web/

RUN pnpm build

# ── deploy-server ─────────────────────────────────────────────────────────────
# pnpm deploy produces a self-contained folder with only production node_modules.
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

CMD ["node", "dist/index.cjs"]

# ── web (runtime) ─────────────────────────────────────────────────────────────
# The Nitro/SolidStart .output directory is fully self-contained — no node_modules needed.
FROM node:24-slim AS web
WORKDIR /app

COPY --from=build /repo/apps/web/.output ./

EXPOSE 3000

ENV PORT=3000

# Configure the backend connection at runtime:
# ENV TRCP_HTTP_URL=http://server:4000
# ENV TRCP_WS_URL=ws://server:4000
# ENV MAPTILER_KEY=your_key_here

CMD ["node", "server/index.mjs"]
