import {number, z} from "zod";

export const positionFields = z.object({
  latitude: z.number(),
  longitude: z.number()
});

export const updatePositionBody = z.strictObject(positionFields.shape)

export type UpdatePositionBody = z.infer<typeof updatePositionBody>;

export const simConfigFields = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(['follow', 'circle']),
  targetLatitude: number(),
  targetLongitude: number(),
  initialDistance: number(),
  initialAzimuth: number(),
  speed: z.number().default(10),
  playing: z.boolean().optional()
});

// POST /api/simconfigs
export const createSimConfigBody =
  z.strictObject(simConfigFields.shape)
    .partial()
    .required({id: true})

// PUT/PATCH /api/simconfigs
export const updateSimConfigBody =
  z.strictObject(simConfigFields.shape)
    .omit({id: true})
    .partial()
;

export const simConfigIdParam = z.object({
  id: z.string().min(1).max(64)
});

export const simConfigResponse = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(['follow', 'circle']),
  targetLatitude: z.number(),
  targetLongitude: z.number(),
  initialDistance: z.number(),
  initialAzimuth: z.number(),
  speed: z.number(),
  playing: z.boolean().optional()
});

export type CreateSimConfigBody = z.infer<typeof createSimConfigBody>;
export type UpdateSimConfigBody = z.infer<typeof updateSimConfigBody>;








