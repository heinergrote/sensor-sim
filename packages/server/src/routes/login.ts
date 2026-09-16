import {Hono} from "hono";
import {zValidator} from "@hono/zod-validator";
import {loginInput} from "../zodSchema";
import {getUserWithSecretsByName} from "../user.service";
import {verifyPassword} from "../util/passwords";
import {JwtPayload} from "../types";
import {sign} from "hono/jwt";

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is not set')
}

const app = new Hono()

  .post('/', zValidator('json', loginInput),
    async (c) => {
      const {username, password} = await c.req.json()

      const user = await getUserWithSecretsByName(username)

      if (!user || !(await verifyPassword(password, user.password))) {
        return c.json({error: "Invalid credentials"}, 401)
      }

      const payload: JwtPayload = {
        sub: user.id,
        username: user.username,
        admin: user.admin,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      }

      const token = await sign(payload, jwtSecret, "HS256")
      return c.json({token})
    })

export default app