import {number, z} from "zod";

export const simConfigIdParam = z.object({
  id: z.coerce.number().int().positive()
});

const positionFields = z.object({
  latitude: z.number(),
  longitude: z.number()
});

export const positionSchema = z.strictObject(positionFields.shape)

// all fields
const simConfigFields = z.object({
  id: z.number().int().positive(),
  ownerId: z.number().int().positive(),
  label: z.string(),
  shareToken: z.string().min(1).max(64),
  type: z.enum(['follow', 'circle']),
  targetLatitude: number(),
  targetLongitude: number(),
  initialDistance: number(),
  initialAzimuth: number(),
  speed: z.number(),
  playing: z.boolean()
});

export const simConfigResponseSchema = z.strictObject(simConfigFields.shape);


// POST /api/simconfigs
export const createSimConfigSchema =
  z.strictObject(simConfigFields.shape)
    .omit({id: true})
    .partial()


// PUT/PATCH /api/simconfigs
export const updateSimConfigSchema =
  z.strictObject(simConfigFields.shape)
    .omit({id: true, ownerId: true, shareToken: true})
    .partial()
;
