# @sensor-sim/shared

Code used by both `@sensor-sim/server` and `@sensor-sim/frontend`: the API contract (Zod schemas and the DTO types
inferred from them, plus `SimData`, `StatusMessage` and `Profile`) and pure geo helpers.

```
src/schemas/simconfigs.ts  specTypesSchema, spec{Fixed,Path,Orbit}Schema, specSchema (discriminated union on
                           `type`), simConfigResponseSchema, createSimConfigSchema, updateSimConfigSchema,
                           updateTypeSchema, simConfigIdParam
src/schemas/users.ts       userResponseSchema, createUserSchema, updateUserSchema, userIdParamSchema
src/schemas/login.ts       login
src/types.ts               DTO types (z.infer), Spec, SpecType, SpecFixed/Path/Orbit, GeoPosition, SimData,
                           StatusMessage, Profile
src/index.ts               re-exports schemas + types            → import from "@sensor-sim/shared"
src/util/geoUtils.ts       getPosition, getDistance, getAzimuth, randomOffset, randomBetween
                                                                 → "@sensor-sim/shared/geoUtils"
```

`SimConfig.spec` is `Spec | null`. Spec schemas are `strictObject`s; a new spec type is added to both
`specTypesSchema` and `specSchema` (server side: see `packages/server/CLAUDE.md`). `getPosition` returns the origin
for a distance ≤ 0.

`geoUtils` is a separate subpath export so a runtime import of it doesn't drag the Zod schemas into the frontend
bundle (type-only imports from the root are erased anyway).

Source-only: `exports` points at `.ts` files, there is no build step. The server bundles it via tsdown (`noExternal`),
Vite compiles it for the frontend. Keep it free of server-only code (Drizzle row types, Hono, node
APIs) — runtime dependencies are `zod` and `@turf/turf`.

```bash
pnpm typecheck    # tsc --noEmit
```
