import {z} from "zod";
import {createUserSchema, updateUserSchema, userResponseSchema} from "./schemas/users";
import {
  createSimConfigSchema,
  simConfigResponseSchema,
  specFixedSchema,
  specOrbitSchema,
  specPathSchema,
  specSchema,
  specTypesSchema,
  updateSimConfigSchema
} from "./schemas/simconfigs";

export type SimData = {
  position: { latitude: number, longitude: number },
}

export type StatusMessage = {
  type: "configUpdate",
  /** the owner's config revision after the change; compare with `CONFIG_REVISION_HEADER` of `GET /api/configs` */
  revision: number
} | {
  type: "ping"
}
/** Response header of `GET /api/configs`: the owner's config revision the returned list is at least as new as. */
export const CONFIG_REVISION_HEADER = "X-Config-Revision";
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

export type GeoPosition = readonly [number, number]
export type SpecType = z.infer<typeof specTypesSchema>;
export type SpecFixed = z.infer<typeof specFixedSchema>
export type SpecPath = z.infer<typeof specPathSchema>
export type SpecOrbit = z.infer<typeof specOrbitSchema>
export type Spec = z.infer<typeof specSchema>
