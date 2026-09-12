import {number, z} from "zod";

export const simIdInput = z.object({
  id: z.string().min(1).max(64)
});

export const positionInput = z.object({
  latitude: z.number(),
  longitude: z.number()
});

export const simConfigInput = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(['follow', 'circle']).optional(),
  target: positionInput.optional(),
  initialDistance: number().optional(),
  initialAzimuth: number().optional(),
  speed: z.number().default(10).optional(),
  playing: z.boolean().optional()
});

export const simUpdateTargetInput = z.object({
  id: z.string().min(1).max(64),
  target: positionInput,
});


export const simUpdateCurrentInput = z.object({
  id: z.string().min(1).max(64),
  current: positionInput,
});

export type SimConfigInput = z.infer<typeof simConfigInput>;
export type SimUpdateTargetInput = z.infer<typeof simUpdateTargetInput>;
export type SimUpdateCurrentInput = z.infer<typeof simUpdateCurrentInput>;


