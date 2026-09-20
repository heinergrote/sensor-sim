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

You need Node 24+, pnpm, and a Postgres database (both users and simulation
configs are stored there).

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
applies pending migrations and creates the admin account (`DEFAULT_ADMIN_USERNAME`, default `admin`) if it doesn't exist
yet.

`pnpm db:migrate` (drizzle-kit) also applies migrations, but only the schema —
it does not seed the admin, so a fresh database leaves you with no way to log
in. `migrate:dev` runs exactly what the deployed image runs.

Open http://localhost:3000, log in as that admin, create a simulation, and drag
its markers around the map. Under **Users** you can add further accounts;
non-admin accounts can use the simulations but not manage users.

Other root scripts: `pnpm dev:server`, `pnpm dev:frontend`, `pnpm build`,
`pnpm typecheck`.

## Consuming simulated positions

A simulation streams `Simulation` snapshots over `ws://<server>/api/sims/:id/ws`
every 100 ms while it's playing. That endpoint needs a bearer token, same as
the rest of `/api/sims` — pass it either as an `Authorization: Bearer <token>`
header or, since browsers can't set headers on a WebSocket upgrade, as
`?token=<token>` — and the token's user must own that simulation, or the
connection is refused. Use sharing (below) to expose a sim to a caller that
isn't its owner.

To expose one simulation without a login — e.g. to a device under test that
shouldn't hold a full account — an owner can share it: `POST
/api/sims/:id/share` (authenticated, owner only) returns a `{token,
expiryDate}` good for 7 days. That token, not the login JWT, unlocks two
public endpoints: `GET /api/shared/:token` for a one-off snapshot and `GET
/api/shared/:token/ws` for the live stream. `POST /api/sims/:id/unshare`
revokes it immediately.

The sim list itself (`GET /api/sims`) and all other mutations (`POST
/api/sims`, `PUT /api/sims/:id`, `PUT /api/sims/:id/start`, …) are plain REST
and need a bearer token: `POST /api/login` with `{username, password}` returns
one. `GET /api/sims` only lists the caller's own simulations, and every
`/api/sims/:id*` call needs the caller to own that sim (`403` otherwise) — see
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
  ghcr.io/heinergrote/sensor-sim:latest
```

Both users and simulation configs persist in that Postgres database — no
volume is needed on the app container itself, since Postgres (not the app) is
what needs durable storage now. `compose.yaml` runs the image alongside a `db`
service and reads its environment from a local `stack.env`.

## Environment variables

| Variable                 | Default          | Purpose                                       |
|--------------------------|------------------|-----------------------------------------------|
| `DATABASE_URL`           | — (required)     | Postgres connection string for the database   |
| `JWT_SECRET`             | — (required)     | Signing secret for the login tokens           |
| `DEFAULT_ADMIN_USERNAME` | `admin`          | Admin account seeded by the migrate step      |
| `DEFAULT_ADMIN_PASSWORD` | —                | Its password; without it nothing is seeded    |
| `MAPTILER_KEY`           | —                | Required for the `/api/maptiler` tile proxy   |
| `PORT`                   | `4000`           | HTTP port (REST, WebSockets and static files) |
| `VITE_MAP_STYLE`         | server's proxy   | Frontend build-time MapLibre style URL        |
