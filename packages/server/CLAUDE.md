# packages/server

`@sensor-sim/server`: one Hono app on `@hono/node-server` (`PORT`, default 4000). Owns sim configs + users (Postgres
via Drizzle), the in-memory simulation engine, JWT auth, the MapTiler proxy, and serves the built frontend in prod.
Throws at import without `DATABASE_URL` / `JWT_SECRET`. Endpoint tables and env reference: `README.md`.

## Commands (run here, or `pnpm --filter @sensor-sim/server <script>` from root)

```bash
pnpm dev          # tsx watch src/index.ts
pnpm typecheck    # tsc --noEmit
pnpm build        # frontend build → typecheck → tsdown (index + migrate) → copy frontend to dist/public
pnpm start        # node dist/index.js
pnpm migrate:dev  # tsx src/migrate.ts — migrations + admin seed
pnpm migrate      # node dist/migrate.js (same, built)
pnpm db:generate  # schema.ts → new SQL file in drizzle/
pnpm db:migrate   # drizzle-kit, schema only — NO admin seed
pnpm db:push      # dev only, no migration file
pnpm db:studio
```

No test suite. `http/users.http` has ready-made login/user requests.

## Module layout (`src/`) — one directory per feature

```
index.ts                 bootstrap; creates + exports `simulationEngine` (top-level await), mounts subapps,
                         serves frontend, SIGINT/SIGTERM shutdown
types.ts                 server-internal: JWTPayload, HonoGlobalVars {user}, HonoSimRunnerVars {+simRunner},
                         HonoSimConfigsVars {+simConfig}
db/                      schema.ts (tables + *Row types), index.ts (client), dbInit.ts (migrate + seed; migrate.ts only)
simconfigs/              simconfigs.api.ts (/api/configs), .repository.ts, .mapping.ts
simulation/              simulationEngine.ts (Map<id, runner>), simulationRunner.ts (tick loop),
                         simulationDefinitions.ts (registry + polymorphic API), definitions/{fixed,path,orbit}.ts
sims/                    sims.api.ts (/api/sims, read-only)
users/                   users.api.ts (/api/users), user.repository.ts, users.mappings.ts
login/ me/ maptiler/     login.api.ts, me.api.ts, maptiler.api.ts
status/                  status.service.ts (getStatusStream, sendStatusMessage — one stream per user), status.api.ts
shared/                  shared.api.ts — public share-token endpoints
middleware/              jwtAuth (jwtMiddleware, wsJwtMiddleware), requireRole, withOwnSim, simShareMiddleware
util/                    eventStream, passwords (scrypt), appSecret (`jwtSecret()`); geo helpers (incl.
                         randomOffset) come from `@sensor-sim/shared/geoUtils`
```

New feature → new directory with `<name>.api.ts` / `.repository.ts` / mappings, following `simconfigs/` or
`users/`; its Zod schemas (bodies, responses, id params) and DTO types go into `packages/shared/src/schemas`.

## Type layering rules

- **DB layer:** `db/schema.ts` exports `UserRow`/`NewUserRow`/`UpdateUserRow`, `SimConfigRow`/`NewSimConfigRow`.
  Repositories take and return rows only.
- **Network layer:** Zod schemas (`create*`, `update*`, `*Response`, id params, `login`) and their `z.infer`'d DTO
  types live in `@sensor-sim/shared`. Handlers validate with `zValidator` and **return `toDto(row)`, never a raw row** —
  `toDto` is where `password` is stripped.
- **Mappings** (`toCreate`/`toUpdate`/`toDto`) bridge the two. `simconfigs.mapping.ts` holds create defaults
  (`spec: null`, `playing: true`), `stripUndefined` (PATCH semantics: `undefined` dropped, `null` kept) and a
  compile-time `NoExtraKeys` check. `toDto` re-validates `spec` with `specSchema` and returns `null` (logged) for
  an invalid stored spec.
- Row types must not appear in `@sensor-sim/shared`.

## Config vs. runtime

- `/api/configs` is the only write path. Every mutation (create, PATCH, delete, start/stop, share/unshare) calls
  `handleSimConfigsUpdate(userId)` → `simulationEngine.syncConfigs()` (re-reads **all** configs from DB) → a
  per-user debounced (500 ms) `{type: "configUpdate", revision}` on that user's status stream only. Clients of
  other users never see it; `/api/status[/ws]` subscribes to the caller's own stream.
- **Config revision** (in memory, per user, `max(Date.now(), prev + 1)`): bumped *after* the write;
  `GET /api/configs` reads it *before* the DB query and returns it as `X-Config-Revision` (`CONFIG_REVISION_HEADER`,
  exposed via CORS). The client skips a `configUpdate` whose revision it has already fetched — so the tab that
  made the change doesn't refetch twice. Keep both orderings, or a client can skip a change it never saw.
- `syncConfigs` is **serialized** through a promise queue (`syncQueue`) — concurrent requests would otherwise apply
  an older DB snapshot after a newer one and dispose a just-created runner. Always go through `syncConfigs()`,
  never call the inner `doSyncConfigs()` directly.
- A sync only keeps configs with a **valid, non-null `spec`**: those get a runner (new id) or
  `runner.applySimConfig(config)`; runners of deleted *or spec-less* configs are disposed. So a config without spec
  has no runner and `/api/sims/:id` answers 404 for it.
- `applySimConfig` deep-compares (`isDeepStrictEqual`) only `spec` and `playing`; any change stops the runner and,
  if playing, restarts it with state rebuilt from the spec (no live-applied fields any more).
- `SimulationRunner`: 100 ms tick, `state = simulationDefinitions.step(spec, state, deltaMs)`. A stopped runner
  stays in the map and keeps its last state.
- `/api/sims` is read-only: `GET /` (caller's `SimData[]`), `GET /:id`, `GET /:id/ws`.
- Sim ids are serial ints; `label` is a unique text defaulting to `sim-<seq>` (`sim_config_label_seq`).

- `syncConfigs` `dispose()`s and drops runners whose config was deleted. `dispose()` = `stop()` + close the
  runner's `simDataStream`, which ends every WS `collect()` loop; handlers then `ws.close()`, so clients see the
  socket close. `shutdown()` disposes all runners.
- The runner exposes `simData`/`config` as **getters** — keep it that way; returning the variables directly
  snapshots them and goes stale after `start()`/`applySimConfig`.
- `runner.config` only tracks runtime-relevant fields (`applySimConfig` returns early otherwise), so e.g. its
  `shareToken`/`label` can be stale. Read those from the DB — `simShareMiddleware` does.

## Simulation specs (`sim_configs.spec`, jsonb, nullable)

A spec is a Zod discriminated union on `type` (`specSchema` in `@sensor-sim/shared`): `fixed` (lat/lon), `path`
(start → target, `speed`, stops at target), `orbit` (center, `radius`, `startAngle`, `speed`). Movement is
geodesic via `@sensor-sim/shared/geoUtils`. Each type has a `SimulationDefinition<T>` in `simulation/definitions/`:

```
createDefaultSpec(pos?)  random defaults around pos (else within 500 m of `defaultTarget`, Braunschweig)
getLocation(spec)        anchor point (fixed position / path target / orbit center)
init(spec)               initial state — `SimulationStateMap[T]`, always has `position`
step(state, spec, dt)    pure reducer, returns the next state
```

Callers use only the type-erased `simulationDefinitions` facade (`getDefaultSpec`, `getLocation`, `init`, `step`,
`getCurrentPosition`). `PUT /api/configs/:id/type {type}` replaces the spec with `getDefaultSpec(type,
getLocation(oldSpec))`, so switching type keeps the sim in place; clearing it is `PATCH {spec: null}`.

**New spec type:** schema in `shared/src/schemas/simconfigs.ts` (add to `specTypesSchema` + `specSchema`) and its
`Spec*` type in `types.ts` → state entry in `SimulationStateMap` → `definitions/<type>.ts` → register in
`definitionRegistry`. Frontend: a renderer in `components/sims/` + cases in `simulationMap.ts` and `SimCard.tsx`.
Specs are `strictObject`s — stored JSON with extra/missing keys is treated as no spec.

## Auth — each subapp declares its own

```
login.api, shared.api        no JWT                                              → public (shared: share-token gated)
maptiler, me, status         .use(jwtMiddleware)                                 → any logged-in user
simconfigs.api               jwtMiddleware + loadOwnedSimConfig on '/:id/*'      → 400 bad id / 404 / 403 non-owner
sims.api                     wsJwtMiddleware on '/:id/ws', jwtMiddleware,
                             withOwnSimMiddleware() on '/:id/*'                  → 404 / 403 non-owner (engine lookup)
users.api                    jwtMiddleware + requireRole(true)                   → admin only
```

`jwtMiddleware` sets `c.get('user')` (`{id, username, admin}`) — downstream reads that, not the JWT payload.
`wsJwtMiddleware` copies `?token=` into `Authorization`; mount it only on `/ws` routes. Login: HS256, 24 h,
`{sub, username, admin, exp}`; no refresh, no server session.

## Sharing

`POST /api/configs/:id/share` writes `<id>!<nanoid(10)>` (`TOKEN_SEP = "!"`, exported from `simShareMiddleware`) to
`sim_configs.share_token`; `unshare` clears it. No expiry, no signature — the token is an unguessable secret.
`simShareMiddleware` splits off the id, loads the config and requires `share_token === token` (so revoke is
immediate), then sets `simRunner` for `GET /api/shared/:token` and `/:token/ws`. `sharedApp` is mounted twice
(`/api/shared` and `/s`); the frontend builds share URLs on `/s`.

## Gotchas

- Route modules import `simulationEngine` from `../index` — circular import, load-order sensitive.
- `migrate.ts` is a second tsdown entry; `tsdown.config.ts` must list both and `build` must call plain `tsdown`.
- Schema change: edit `db/schema.ts` → `pnpm db:generate` → commit `drizzle/` → `pnpm migrate:dev` → restart.
  Hand-edited SQL is fine (0007 contains a `DELETE FROM sim_configs`). Changing a spec's shape needs no
  migration, but old rows then fail validation and read as `spec: null`.
- `util/eventStream.ts`: `emit(() => v)` stores a producer re-evaluated per read; `.collect(signal)` is the async
  generator each WS iterates until closed.
