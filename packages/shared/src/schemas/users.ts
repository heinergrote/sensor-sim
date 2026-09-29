import {z} from "zod";

export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

const userFields = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  password: z.string().min(3).trim(),
  admin: z.boolean()
});

export const userResponseSchema =
  z.strictObject(userFields.shape)
    .omit({password: true});

export const createUserSchema =
  z.strictObject(userFields.shape)
    .omit({id: true})

export const updateUserSchema =
  z.strictObject(userFields.shape)
    .omit({id: true})
