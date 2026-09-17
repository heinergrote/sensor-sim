# Build context must be the repository root.
#
# Build the image:
#   docker build -t ghcr.io/heinergrote/sensor-sim .

# ── deps ──────────────────────────────────────────────────────────────────────
# Shared install layer. packages/frontend imports AppType from packages/server
# at build time, so both manifests are needed here.
FROM node:24-slim AS deps
RUN corepack enable pnpm
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json      ./packages/server/
COPY packages/frontend/package.json    ./packages/frontend/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────────────────
# Building the server also builds the frontend and bundles its static output
# into packages/server/dist/public (see packages/server/scripts/copy-frontend.mjs),
# so this single build step produces one self-contained server+frontend artifact.
FROM deps AS build
COPY packages/server      ./packages/server
COPY packages/frontend      ./packages/frontend

RUN pnpm --filter @sensor-sim/server build

# ── deploy ────────────────────────────────────────────────────────────────────
# pnpm deploy produces a self-contained folder with only production node_modules.
# package.json#files whitelist ensures only dist/ (server code + bundled
# frontend static assets) is copied, not src/.
FROM build AS deploy

RUN pnpm --filter @sensor-sim/server deploy --prod /deploy

# ── server (runtime) ──────────────────────────────────────────────────────────
# Serves both the API and the static frontend from a single process/origin.
FROM node:24-slim AS server
WORKDIR /app

COPY --from=deploy /deploy ./

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

# Configure at runtime, e.g.:
# ENV MAPTILER_KEY=your_key_here
# ENV STORAGE_DIR=/app/data/storage

CMD ["node", "dist/index.js"]
