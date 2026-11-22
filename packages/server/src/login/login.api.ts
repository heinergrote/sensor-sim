import {Hono} from "hono";
import {zValidator} from "@hono/zod-validator";
import {getUserByName} from "../users/user.repository";
import {verifyPassword} from "../util/passwords";
import {login, refreshRequest} from "@sensor-sim/shared";
import {clientInfo, createSession, endSession, refreshSession} from "../sessions/sessions.service";
import {deleteExpiredSessions} from "../sessions/sessions.repository";

export const loginApp = new Hono()

  .post('/', zValidator('json', login),
    async (c) => {
      const {username, password} = c.req.valid("json")

      const user = await getUserByName(username)

      if (!user || !(await verifyPassword(password, user.password))) {
        return c.json({error: "Invalid credentials"}, 401)
      }

      await deleteExpiredSessions(user.id)
      return c.json(await createSession(user, clientInfo(c)))
    })

  .post('/refresh', zValidator('json', refreshRequest),
    async (c) => {
      const {refreshToken} = c.req.valid("json")
      const tokens = await refreshSession(refreshToken, clientInfo(c))
      if (!tokens) {
        return c.json({error: "Invalid or expired session"}, 401)
      }
      return c.json(tokens)
    })

  .post('/logout', zValidator('json', refreshRequest),
    async (c) => {
      const {refreshToken} = c.req.valid("json")
      await endSession(refreshToken)
      return c.body(null, 204)
    })
