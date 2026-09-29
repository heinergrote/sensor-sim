import {z} from "zod";
import {createUserSchema, updateUserSchema, userResponseSchema} from "./schemas/users";
import {
  createSimConfigSchema,
  positionSchema,
  simConfigResponseSchema,
  updateSimConfigSchema
} from "./schemas/simconfigs";

export type SimState = {
  id: number,
  start: number,
  current: GeoPosition,
  distance: number,
  azimuth: number,
}
export type StatusMessage = {
  type: "configUpdate",
  updatedAt: number
} | {
  type: "ping"
}
export type StatusMessageTypes = StatusMessage['type'];
export type Profile = {
  id: number,
  username: string,
  admin: boolean,
}
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type User = z.infer<typeof userResponseSchema>;

export type CreateSimConfig = z.infer<typeof createSimConfigSchema>;
export type UpdateSimConfig = z.infer<typeof updateSimConfigSchema>;
export type SimConfig = z.infer<typeof simConfigResponseSchema>;

export type GeoPosition = z.infer<typeof positionSchema>;
