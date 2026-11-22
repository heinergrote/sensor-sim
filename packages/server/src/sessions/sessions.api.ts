import {Hono} from "hono";
import {jwtMiddleware} from "../middleware/jwtAuth";
import {HonoGlobalVars} from "../types";
import {zValidator} from "@hono/zod-validator";
import {sessionIdParamSchema} from "@sensor-sim/shared";
import {getActiveSessions, revokeUserSession} from "./sessions.repository";
import {toDto} from "./sessions.mapping";

/** The caller's own active sessions. Another user's: `GET /api/users/:id/sessions` (admin). */
export const sessionsApp = new Hono<{ Variables: HonoGlobalVars }>()

  .use('*', jwtMiddleware)

  .get('/', async (c) => {
    const sessions = await getActiveSessions(c.var.user.id)
    return c.json(sessions.map(row => toDto(row, c.var.sessionId)))
  })

  // stops the session's next refresh; its current access token stays valid until it expires (≤ 15 min)
  .delete('/:id',
    zValidator('param', sessionIdParamSchema),
    async (c) => {
      const {id} = c.req.valid('param')
      if (!(await revokeUserSession(c.var.user.id, id))) {
        return c.json({error: 'Session not found'}, 404)
      }
      return c.body(null, 204)
    })
