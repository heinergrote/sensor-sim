# sensor-sim

(Work in progress, but should work)

GPS simulation for testing location-aware apps. Create simulated devices that move toward a target or orbit a
point, watch them live on a map, and feed their positions into your own app as if they came from a real GPS.

- **[packages/server](packages/server)** — sim configs, the simulation engine, REST + WebSocket API, users and JWT
  auth, MapTiler proxy; in production it serves the UI too.
- **[packages/frontend](packages/frontend)** — the management UI: map, simulation controls, user administration (SolidJS
  2 + MapLibre).
- **[packages/shared](packages/shared)** — the API contract (Zod schemas and DTO types) used by both.

## Quick start

You need Node 24+, pnpm and a Postgres database. Create `packages/server/.env`:

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

The server does **not** migrate on boot — run `migrate:dev` on a fresh database and after every schema change.
(`db:migrate` applies the schema but skips the admin seed, leaving no way to log in.)

Open http://localhost:3000, log in as `admin` (or `DEFAULT_ADMIN_USERNAME`), create a simulation and drag its
markers on the map. Admins can add further users under **Users**.

Other root scripts: `pnpm dev:server`, `pnpm dev:frontend`, `pnpm build`, `pnpm typecheck`.

## How it works

A simulation has two halves:

- **Config** — persisted in Postgres, edited via `/api/configs` (target, initial distance/azimuth, type, speed,
  `playing`, share token). All changes, including start/stop, go here.
- **Runtime** — an in-memory runner per config, ticking every 100 ms and exposing a `SimData` (current position,
  distance, azimuth) via read-only `/api/sims`.

After every config change the server re-syncs the runners from the database and signals `/api/status/ws`, so clients
know to refetch the config list.

## Consuming simulated positions

`ws://<server>/api/sims/:id/ws` streams `SimData` on every tick. It needs a bearer token (header or `?token=`) and
the caller must own the simulation. `POST /api/login` with `{username, password}` returns a token.

To expose one simulation without an account, its owner calls `POST /api/configs/:id/share`, which returns
`{token, expiryDate}` (valid 7 days). That token unlocks the public `GET /api/shared/:token` and
`GET /api/shared/:token/ws`; `POST /api/configs/:id/unshare` revokes it.

To make an existing web app believe it's moving, use [sensor-mock](https://www.npmjs.com/package/sensor-mock):

```ts
import {enableSensorMock} from "sensor-mock";

enableSensorMock({serverUrl: "http://localhost:4000", simId: "my-sim"});
// navigator.geolocation now reports the simulation's position
```

Full API: [packages/server/README.md](packages/server/README.md).

## Deployment

One image serves the API and UI on the same origin, next to a Postgres:

```bash
docker run -p 4000:4000 \
  -e DATABASE_URL=postgres://user:password@db:5432/sensorsim \
  -e JWT_SECRET=... \
  -e DEFAULT_ADMIN_PASSWORD=... \
  -e MAPTILER_KEY=... \
  ghcr.io/heinergrote/sensor-sim:latest
```

`compose.yaml` runs `db` → `migrate` (one-shot) → `server`. Users and sim configs both live in Postgres; the app
container needs no volume.

> **Upgrading to the config/runtime split** (PR [#10](https://github.com/heinergrote/sensor-sim/pull/10)):
> migration `0007` deletes all existing sim configs — sim ids are now integers with a separate `label`.

## Environment variables

| Variable                 | Default        | Purpose                                       |
|--------------------------|----------------|-----------------------------------------------|
| `DATABASE_URL`           | — (required)   | Postgres connection string                    |
| `JWT_SECRET`             | — (required)   | Signs login and share tokens                  |
| `DEFAULT_ADMIN_USERNAME` | `admin`        | Admin account seeded by the migrate step      |
| `DEFAULT_ADMIN_PASSWORD` | —              | Its password; without it nothing is seeded    |
| `MAPTILER_KEY`           | —              | Required for the `/api/maptiler` tile proxy   |
| `PORT`                   | `4000`         | HTTP port (REST, WebSockets and static files) |
| `VITE_MAP_STYLE`         | server's proxy | Frontend build-time MapLibre style URL        |
