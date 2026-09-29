import {Hono} from "hono";
import {zValidator} from "@hono/zod-validator";
import {getUserByName} from "../users/user.repository";
import {verifyPassword} from "../util/passwords";
import {sign} from "hono/jwt";
import {JWTPayload} from "../types";
import {login} from "@sensor-sim/shared";

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is not set')
}

export const loginApp = new Hono()

  .post('/', zValidator('json', login),
    async (c) => {
      const {username, password} = c.req.valid("json")

      const user = await getUserByName(username)

      if (!user || !(await verifyPassword(password, user.password))) {
        return c.json({error: "Invalid credentials"}, 401)
      }

      const payload = {
        sub: user.id,
        username: user.username,
        admin: user.admin,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      } as JWTPayload

      const token = await sign(payload, jwtSecret, "HS256")
      return c.json({token})
    })

