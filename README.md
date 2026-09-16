# sensor-sim

(Work in progress, but should work)

GPS simulation for testing location-aware apps. Create simulated devices that
move toward a target or orbit a point, watch them live on a map, and feed their
positions into your own app as if they came from a real GPS.

- **[packages/server](packages/server)** — the simulation engine: REST +
  WebSocket API, user accounts and JWT auth, MapTiler proxy, and in production
  it serves the UI too.
- **[packages/frontend](packages/frontend)** — the management UI: map, live
  simulation controls and user administration (SolidJS 2 + MapLibre).

## Quick start

You need Node 24+, pnpm, and a Postgres database (users are stored there;
simulation configs are plain files).

Create `packages/server/.env`:

```dotenv
DATABASE_URL=postgres://user:password@localhost:5432/sensorsim
JWT_SECRET=some-long-random-string
DEFAULT_ADMIN_PASSWORD=choose-one     # seeds the first admin when migrations run
MAPTILER_KEY=your-maptiler-key        # for map tiles; stays server-side
```

```bash
pnpm install
pnpm --filter @sensor-sim/server migrate:dev   # schema + admin account
pnpm dev                                       # server on :4000, UI on :3000
```

The migrate step is separate on purpose — the server does **not** migrate on
boot. Run it once on a fresh database and again after any schema change. It
applies pending migrations and creates the admin account
(`DEFAULT_ADMIN_USERNAME`, default `admin`) if it doesn't exist yet.

`pnpm db:migrate` (drizzle-kit) also applies migrations, but only the schema —
it does not seed the admin, so a fresh database leaves you with no way to log
in. `migrate:dev` runs exactly what the deployed image runs.

Open http://localhost:3000, log in as that admin, create a simulation, and drag
its markers around the map. Under **Users** you can add further accounts;
non-admin accounts can use the simulations but not manage users.

Other root scripts: `pnpm dev:server`, `pnpm dev:frontend`, `pnpm build`,
`pnpm typecheck`.

## Consuming simulated positions

A simulation streams `Simulation` snapshots over `ws://<server>/ws/sims/:id`
every 100 ms, and the full list over `/ws/sims`. Those WebSocket endpoints are
open — no token needed — so a device under test can just connect.

Mutations go over REST at `/api/sims` (`POST /api/sims`, `PUT /api/sims/:id`,
`PUT /api/sims/:id/start`, …) and **do** need a bearer token: `POST /api/login`
with `{username, password}` returns one. See
[packages/server/README.md](packages/server/README.md).

To make an existing web app believe it's moving, use the
[sensor-mock](https://www.npmjs.com/package/sensor-mock) library instead of
wiring up the WebSocket yourself:

```ts
import {enableSensorMock} from "sensor-mock";

enableSensorMock({serverUrl: "http://localhost:4000", simId: "my-sim"});
// navigator.geolocation now reports the simulation's position
```

## Deployment

One process serves the API and the built UI on the same origin, so there is a
single image to run — plus a Postgres it can reach:

```bash
docker run -p 4000:4000 \
  -e DATABASE_URL=postgres://user:password@db:5432/sensorsim \
  -e JWT_SECRET=... \
  -e DEFAULT_ADMIN_PASSWORD=... \
  -e MAPTILER_KEY=... \
  -v sensor-sim-data:/app/data/storage \
  ghcr.io/heinergrote/sensor-sim:latest
```

Mount a volume at `/app/data/storage` — simulation configs are persisted there
and reloaded on startup; users live in Postgres.
`docker-compose/sensor-sim/compose.yml` runs the image with that volume and
reads its environment from a local `.env`.

## Environment variables

| Variable                 | Default          | Purpose                                             |
|--------------------------|------------------|-----------------------------------------------------|
| `DATABASE_URL`           | — (required)     | Postgres connection string for the user store       |
| `JWT_SECRET`             | — (required)     | Signing secret for the login tokens                 |
| `DEFAULT_ADMIN_USERNAME` | `admin`          | Admin account seeded by the migrate step            |
| `DEFAULT_ADMIN_PASSWORD` | —                | Its password; without it nothing is seeded          |
| `MAPTILER_KEY`           | —                | Required for the `/api/maptiler` tile proxy         |
| `PORT`                   | `4000`           | HTTP port (REST, WebSockets and static files)       |
| `STORAGE_DIR`            | `./data/storage` | Where simulation configs are persisted              |
| `VITE_MAP_STYLE`         | server's proxy   | Frontend build-time MapLibre style URL              |
