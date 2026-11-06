import {literal, number, tuple, z} from "zod";

export const simConfigIdParam = z.object({
  id: z.coerce.number().int().positive()
});

export const specTypesSchema = z.enum(['fixed', 'path', 'orbit'])

export const specFixedSchema = z.strictObject({
  type: literal("fixed"),
  position: tuple([number(), number()]).readonly(),
});

export const specPathSchema = z.strictObject({
  type: literal("path"),
  target: tuple([number(), number()]).readonly(),
  start: tuple([number(), number()]).readonly(),
  speed: z.number(),
});


export const specOrbitSchema = z.strictObject({
  type: literal("orbit"),
  center: tuple([number(), number()]).readonly(),
  radius: number(),
  startAngle: number(),
  speed: z.number(),
});

export const specSchema = z.discriminatedUnion("type", [
  specFixedSchema,
  specPathSchema,
  specOrbitSchema,
])

// all fields
const simConfigFields = z.object({
  id: z.number().int().positive(),
  ownerId: z.number().int().positive(),
  label: z.string(),
  shareToken: z.string().min(0).max(64),
  spec: specSchema.nullable(),
  playing: z.boolean()
});

export const simConfigResponseSchema = z.strictObject(simConfigFields.shape);

// POST /api/simconfigs
export const createSimConfigSchema =
  z.strictObject(simConfigFields.shape)
    .omit({id: true, ownerId: true, shareToken: true})
    .partial()

// PUT/PATCH /api/simconfigs
export const updateSimConfigSchema =
  z.strictObject(simConfigFields.shape)
    .omit({id: true, ownerId: true, shareToken: true})
    .partial()

export const updateTypeSchema =
  z.object({
    type: specTypesSchema
  })

