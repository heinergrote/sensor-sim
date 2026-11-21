import {z} from "zod";

export const login = z.object({
  username: z.string(),
  password: z.string(),
});

/** body of `POST /api/login/refresh` and `POST /api/login/logout` */
export const refreshRequest = z.object({
  refreshToken: z.string().min(1),
});

/** response of `POST /api/login` and `POST /api/login/refresh` */
export const loginResponse = z.object({
  /** short-lived HS256 JWT for `Authorization: Bearer` / `?token=` */
  accessToken: z.string(),
  /** opaque, rotated on every refresh — the previous one is invalid afterwards */
  refreshToken: z.string(),
  /** access token expiry, epoch milliseconds */
  accessExpiresAt: z.number(),
});

export type Login = z.infer<typeof login>;
export type RefreshRequest = z.infer<typeof refreshRequest>;
export type LoginResponse = z.infer<typeof loginResponse>;
