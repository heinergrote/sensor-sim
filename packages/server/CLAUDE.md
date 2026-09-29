# packages/server

`@sensor-sim/server`: one Hono app on `@hono/node-server` (`PORT`, default 4000). Owns sim configs + users (Postgres
via Drizzle), the in-memory simulation engine, JWT auth, the MapTiler proxy, and serves the built frontend in prod.
Throws at import without `DATABASE_URL` / `JWT_SECRET`. Endpoint tables and env reference: `README.md`.

## Commands (run here, or `pnpm --filter @sensor-sim/server <script>` from root)

```bash
pnpm dev          # tsx watch src/index.ts
pnpm typecheck    # tsc --noEmit
pnpm build        # frontend build → typecheck → tsup (index + migrate) → copy frontend to dist/public
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
simconfigs/              simconfigs.api.ts (/api/configs), .repository.ts, mappings.ts
simengine/               simulationEngine.ts (Map<id, runner>), simulationRunner.ts (tick loop), sims.api.ts (/api/sims)
users/                   users.api.ts (/api/users), user.repository.ts, users.mappings.ts
login/ me/ maptiler/     login.api.ts, me.api.ts, maptiler.api.ts
status/                  status.service.ts (statusStream, sendStatusMessage), status.api.ts
shared/                  shared.api.ts — public share-token endpoints
middleware/              jwtAuth (jwtMiddleware, wsJwtMiddleware), requireRole, withOwnSim, simShareMiddleware
util/                    shareTokens, eventStream, passwords (scrypt), appSecret; geo helpers (incl.
                         randomOffset) come from `@sensor-sim/shared/geoUtils`
```

New feature → new directory with `<name>.api.ts` / `.repository.ts` / mappings, following `simconfigs/` or
`users/`; its Zod schemas (bodies, responses, id params) and DTO types go into `packages/shared/src/schemas`.

## Type layering rules

- **DB layer:** `db/schema.ts` exports `UserRow`/`NewUserRow`/`UpdateUserRow`, `SimConfigRow`/`NewSimConfig`.
  Repositories take and return rows only.
- **Network layer:** Zod schemas (`create*`, `update*`, `*Response`, id params, `login`) and their `z.infer`'d DTO
  types live in `@sensor-sim/shared`. Handlers validate with `zValidator` and **return `toDto(row)`, never a raw row** —
  `toDto` is where `password` is stripped.
- **Mappings** (`toInsert`/`toUpdate`/`toDto`) bridge the two. `simconfigs/mappings.ts` holds create defaults and
  `stripUndefined` (PATCH semantics: `undefined` dropped, `null` kept) plus a compile-time `NoExtraKeys` check.
- Row types must not appear in `@sensor-sim/shared`.

## Config vs. runtime

- `/api/configs` is the only write path. Every mutation (create, PATCH, delete, start/stop, share/unshare) calls
  `handleSimConfigsUpdate()` → `simulationEngine.syncConfigs()` (re-reads **all** configs from DB) → a debounced (500
  ms) `{type: "configUpdate", updatedAt}` on `statusStream`.
- `syncConfigs` is **serialized** through a promise queue (`syncQueue`) — concurrent requests would otherwise apply
  an older DB snapshot after a newer one and dispose a just-created runner. Always go through `syncConfigs()`,
  never call the inner `doSyncConfigs()` directly.
- A sync creates a runner for new ids and calls `runner.applySimConfig(config)` on existing ones.
  `applySimConfig` ignores changes outside `type/playing/target*/initial*/speed`; `type`/`speed` apply live, the
  rest restart the runner (state rebuilt from config).
- `SimulationRunner`: 100 ms tick; `follow` moves toward target and snaps at 0; `circle` orbits at the current
  radius. A stopped runner stays in the map and keeps its last state (no `null` state any more).
- `/api/sims` is read-only: `GET /` (caller's `SimState[]`), `GET /:id`, `GET /:id/ws`.
- Sim ids are serial ints; `label` is a unique text defaulting to `sim-<seq>` (`sim_config_label_seq`).

- `syncConfigs` `dispose()`s and drops runners whose config was deleted. `dispose()` = `stop()` + close the
  runner's `simStateStream`, which ends every WS `collect()` loop; handlers then `ws.close()`, so clients see the
  socket close. `shutdown()` disposes all runners.
- The runner exposes `simState`/`config` as **getters** — keep it that way; returning the variables directly
  snapshots them and goes stale after `start()`/`applySimConfig`.
- `runner.config` only tracks runtime-relevant fields (`applySimConfig` returns early otherwise), so e.g. its
  `shareToken`/`label` can be stale. Read those from the DB — `simShareMiddleware` does.

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

`POST /api/configs/:id/share` mints a 7-day HMAC-SHA256 token (`util/shareTokens.ts`, not a JWT; payload sim id +
owner id + expiry, signed with `JWT_SECRET`) into `sim_configs.share_token`; `unshare` clears it.
`simShareMiddleware` verifies signature/expiry and that the token equals the DB row's current `share_token` and
owner, then sets `simRunner` for `GET /api/shared/:token` and `/:token/ws`.

## Gotchas

- Route modules import `simulationEngine` from `../index` — circular import, load-order sensitive.
- `migrate.ts` is a second tsup entry; `tsup.config.ts` must list both and `build` must call plain `tsup`.
- Schema change: edit `db/schema.ts` → `pnpm db:generate` → commit `drizzle/` → `pnpm migrate:dev` → restart.
  Hand-edited SQL is fine (0007 contains a `DELETE FROM sim_configs`).
- `util/eventStream.ts`: `emit(() => v)` stores a producer re-evaluated per read; `.collect(signal)` is the async
  generator each WS iterates until closed.
