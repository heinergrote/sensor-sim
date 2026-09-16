import {JwtPayload} from "../types";
import {getUserById} from "../user.service";
import {createMiddleware} from 'hono/factory'

interface VerifyAuthOptions {
  checkDb?: boolean
}

export const verifyAuth = (
  requireAdmin: boolean,
  options: VerifyAuthOptions = {}
) => {
  return createMiddleware(async (c, next) => {

      const payload = c.get('jwtPayload') as JwtPayload
      if (!payload) {
        return c.json({error: 'Unauthorized'}, 401)
      }

      let userIsAdmin = payload.admin || false;

      // Optional db fallback (for critical actions or fast-revocation security)
      if (options.checkDb) {
        const dbUser = await getUserById(payload.sub)

        if (!dbUser) {
          return c.json({error: 'User not found/disabled'}, 403)
        }

        userIsAdmin = dbUser.admin
      }

      const validRole = !requireAdmin || userIsAdmin
      if (!validRole) {
        return c.json({error: 'Forbidden: Insufficient permissions'}, 403)
      }

      await next()
    }
  )
}