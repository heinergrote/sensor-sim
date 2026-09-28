import {z} from "zod";
import {createUserSchema, updateUserSchema, userResponseSchema} from "./users/users.schemas";
import {
  createSimConfigSchema,
  positionSchema,
  simConfigResponseSchema,
  updateSimConfigSchema
} from "./simconfigs/simconfigs.schemas";

export type SimState = {
  id: number,
  start: number,
  current: PositionDto,
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
export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type UserDto = z.infer<typeof userResponseSchema>;
export type CreateSimConfigDto = z.infer<typeof createSimConfigSchema>;
export type UpdateSimConfigDto = z.infer<typeof updateSimConfigSchema>;
export type SimConfigDto = z.infer<typeof simConfigResponseSchema>;
export type PositionDto = z.infer<typeof positionSchema>;