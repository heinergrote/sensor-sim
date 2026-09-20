import {getUserById} from "../user.service";
import {createMiddleware} from "hono/factory";
import {HonoGlobalVars} from "../types";

interface RequireRoleOptions {
  checkDb?: boolean
}

// assumes that the jwt payload is valid and has a sub property
// (e.g. set by jwtMiddleware)

export const requireRole = (
  requireAdmin: boolean,
  options: RequireRoleOptions = {}
) => {
  return createMiddleware<{ Variables: HonoGlobalVars }>(async (c, next) => {

      const user = c.get('user')
      if (!user) {
        return c.json({error: 'Unauthorized'}, 401)
      }

      let userIsAdmin = user.admin;

      // Optional db fallback (for critical actions or fast-revocation security)
      if (options.checkDb) {
        const dbUser = await getUserById(user.id)

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


