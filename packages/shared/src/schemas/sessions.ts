import {z} from "zod";

/** A login session (`GET /api/sessions`, `GET /api/users/:id/sessions`). Timestamps are ISO strings. */
export const sessionResponseSchema = z.strictObject({
  id: z.number().int().positive(),
  userAgent: z.string(),
  ip: z.string(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  /** the session of the access token making this request */
  current: z.boolean(),
});

export type Session = z.infer<typeof sessionResponseSchema>;

/** `DELETE /api/sessions/:id` */
export const sessionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** `DELETE /api/users/:id/sessions/:sessionId` */
export const userSessionParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  sessionId: z.coerce.number().int().positive(),
});
