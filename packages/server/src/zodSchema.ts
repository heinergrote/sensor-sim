import {number, z} from "zod";

export const simIdInput = z.object({
  id: z.string().min(1).max(64)
});

export const positionInput = z.object({
  latitude: z.number(),
  longitude: z.number()
});

export const simConfigInput = z.object({
  type: z.enum(['follow', 'circle']).optional(),
  target: positionInput.optional(),
  initialDistance: number().optional(),
  initialAzimuth: number().optional(),
  speed: z.number().default(10).optional(),
  playing: z.boolean().optional()
});

// adds an id to simConfigInput
export const simCreateInput = simConfigInput.extend({
  id: z.string().min(1).max(64),
})

export type SimConfigInput = z.infer<typeof simConfigInput>;
export type SimCreateInput = z.infer<typeof simCreateInput>;
export type PositionInput = z.infer<typeof positionInput>;

export const userInput = z.object({
  username: z.string().trim(),
  password: z.string().trim().optional(),
  admin: z.boolean().default(false),
});


export const userUpdate = userInput.partial();


export type UserInput = z.infer<typeof userInput>;
export type UserUpdate = z.infer<typeof userUpdate>;





