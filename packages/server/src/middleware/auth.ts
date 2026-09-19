import {JWTPayload} from "../types";
import {getUserById} from "../user.service";
import {createMiddleware} from 'hono/factory'
import {jwt} from 'hono/jwt'
import {appSecret} from "../util/appSecret";

export const builtinJwt = jwt({secret: appSecret(), alg: "HS256"})

// Header-only bearer auth — the normal case for plain REST routes.
export const jwtMiddleware = builtinJwt

// Same check, but also accepts the token as a `?token=` query param — needed
// because a browser WebSocket upgrade can't set custom headers. Apply this
// only to `/ws` routes, not general REST ones, so bearer tokens don't end up
// in URLs (and therefore access logs / browser history / Referer headers)
// for requests that could otherwise just use the Authorization header.
export const wsJwtMiddleware = createMiddleware(async (c, next) => {

  const token = c.req.query('token') // e.g., ?token=xyz
  if (token) {
    // Inject it into the request headers so the built-in middleware can find it
    c.req.raw.headers.set('Authorization', `Bearer ${token}`)
  }

  return builtinJwt(c, next)
})


interface RequireRoleOptions {
  checkDb?: boolean
}

export const requireRole = (
  requireAdmin: boolean,
  options: RequireRoleOptions = {}
) => {
  return createMiddleware(async (c, next) => {

      const payload = c.get('jwtPayload') as JWTPayload
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


