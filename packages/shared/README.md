# @sensor-sim/shared

Code used by both `@sensor-sim/server` and `@sensor-sim/frontend`: the API contract (Zod schemas and the DTO types
inferred from them, plus `SimData`, `StatusMessage` and `Profile`) and pure geo helpers.

```
src/schemas/simconfigs.ts  positionSchema, simConfigResponseSchema, createSimConfigSchema, updateSimConfigSchema,
                           simConfigIdParam
src/schemas/users.ts       userResponseSchema, createUserSchema, updateUserSchema, userIdParamSchema
src/schemas/login.ts       login
src/types.ts               *Dto types (z.infer), SimData, StatusMessage, ConfigType, Profile
src/index.ts               re-exports schemas + types            → import from "@sensor-sim/shared"
src/util/geoUtils.ts       getPosition, getDistance, getAzimuth, randomOffset → "@sensor-sim/shared/geoUtils"
```

`geoUtils` is a separate subpath export so a runtime import of it doesn't drag the Zod schemas into the frontend
bundle (type-only imports from the root are erased anyway).

Source-only: `exports` points at `.ts` files, there is no build step. The server bundles it via tsup (`noExternal`),
Vite compiles it for the frontend. Keep it free of server-only code (Drizzle row types, Hono, node
APIs) — runtime dependencies are `zod` and `@turf/turf`.

```bash
pnpm typecheck    # tsc --noEmit
```
