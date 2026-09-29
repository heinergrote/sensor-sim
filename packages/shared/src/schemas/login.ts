import {z} from "zod";

export const login = z.object({
  username: z.string(),
  password: z.string(),
});
