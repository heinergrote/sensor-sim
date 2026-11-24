# sensor-sim

(Work in progress, but should work)

GPS simulation for testing location-aware apps. Create simulated devices that stand still (`fixed`), follow a route
of waypoints (`path`) or circle a point (`orbit`), watch them live on a map, and feed their positions into your
own app as if they came from a real GPS.

- **[packages/server](packages/server)** — sim configs, the simulation engine, REST + WebSocket API, users and JWT
  auth, map tile proxy (OpenFreeMap by default, MapTiler optional); in production it serves the UI too.
- **[packages/frontend](packages/frontend)** — the management UI: map, simulation controls, user administration (SolidJS
  2 + MapLibre).
- **[packages/shared](packages/shared)** — the API contract (Zod schemas and DTO types) used by both.

## Quick start

You need Node 24+, pnpm and a Postgres database. Create `packages/server/.env`:

```dotenv
DATABASE_URL=postgres://user:password@localhost:5432/sensorsim
JWT_SECRET=some-long-random-string
DEFAULT_ADMIN_PASSWORD=choose-one     # seeds the first admin when migrations run
# TILE_PROVIDER=maptiler             # default: openfreemap (no key needed)
# MAPTILER_KEY=your-maptiler-key      # only for maptiler; stays server-side
```

```bash
pnpm install
pnpm --filter @sensor-sim/server migrate:dev   # schema + admin account
pnpm dev                                       # server on :4000, UI on :3000
```

The server does **not** migrate on boot — run `migrate:dev` on a fresh database and after every schema change.
(`db:migrate` applies the schema but skips the admin seed, leaving no way to log in.)

Open http://localhost:3000, log in as `admin` (or `DEFAULT_ADMIN_USERNAME`), create a simulation under **Simulations**,
select it in the list and pick its type (placed at the current map center). Edit it on the map — click to place a
fixed position or orbit center, drag the orbit markers, or draw the route for a path; edits autosave by default. Admins can add further users under **Users**.

Other root scripts: `pnpm dev:server`, `pnpm dev:frontend`, `pnpm build`, `pnpm typecheck`.

## How it works

A simulation has two halves:

- **Config** — persisted in Postgres, edited via `/api/configs`: `label`, `playing`, share token and a typed JSON
  `spec` (`fixed` / `path` / `orbit`, or `null` = not configured yet). All changes, including start/stop, go here.
- **Runtime** — an in-memory runner per config with a spec, ticking every 100 ms and exposing a `SimData` (current
  position) via read-only `/api/sims`.

After every config change the server re-syncs the runners from the database and signals `/api/status/ws`, so other
clients of the same user can offer a refresh.

## Consuming simulated positions

`ws://<server>/api/sims/:id/ws` streams `SimData` on every tick. It needs a bearer token (header or `?token=`) and
the caller must own the simulation. `POST /api/login` with `{username, password}` returns a token.

To expose one simulation without an account, its owner calls `POST /api/configs/:id/share`, which returns
`{token}` (`<id>!<10 chars>`, no expiry). That token unlocks the public `GET /api/shared/:token` and
`GET /api/shared/:token/ws` (also mounted at `/s/:token[/ws]`); `POST /api/configs/:id/unshare` revokes it.

To make an existing web app believe it's moving, use [sensor-mock](https://www.npmjs.com/package/sensor-mock):

```ts
import {enableSensorMock} from "sensor-mock";

enableSensorMock({url: "https://<share_url>"});
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
  ghcr.io/heinergrote/sensor-sim:latest
```

`compose.yaml` runs `db` → `migrate` (one-shot) → `server`. Users and sim configs both live in Postgres; the app
container needs no volume.

> **Upgrading to the config/runtime split** (PR [#10](https://github.com/heinergrote/sensor-sim/pull/10)):
> migration `0007` deletes all existing sim configs — sim ids are now integers with a separate `label`.
>
> **Upgrading to JSON specs:** migrations `0008`/`0009` replace the target/initial/type/speed columns with `spec`;
> existing configs keep their id and label but come back with `spec: null` — pick a type again.
>
> **Upgrading to waypoint paths:** path specs stored with `start`/`target` come back as `spec: null` — pick Path again.

## Environment variables

| Variable                 | Default        | Purpose                                       |
|--------------------------|----------------|-----------------------------------------------|
| `DATABASE_URL`           | — (required)   | Postgres connection string                    |
| `JWT_SECRET`             | — (required)   | Signs login tokens                            |
| `DEFAULT_ADMIN_USERNAME` | `admin`        | Admin account seeded by the migrate step      |
| `DEFAULT_ADMIN_PASSWORD` | —              | Its password; without it nothing is seeded    |
| `TILE_PROVIDER`          | `openfreemap`  | Tile provider behind `/api/tiles` (`openfreemap` / `maptiler`) |
| `TILE_STYLE`             | per provider   | Upstream style path behind `/api/tiles/style.json` |
| `MAPTILER_KEY`           | —              | Required with `TILE_PROVIDER=maptiler`        |
| `PORT`                   | `4000`         | HTTP port (REST, WebSockets and static files) |
| `VITE_MAP_STYLE`         | server's proxy | Frontend build-time MapLibre style URL        |
