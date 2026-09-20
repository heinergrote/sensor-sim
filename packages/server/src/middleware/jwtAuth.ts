import {createMiddleware} from 'hono/factory'
import {jwt, JwtVariables} from 'hono/jwt'
import {appSecret} from "../util/appSecret";
import {HonoGlobalVars, JWTPayload} from "../types";

export const builtinJwt = jwt({secret: appSecret(), alg: "HS256"})

export const jwtMiddleware = createMiddleware<{ Variables: HonoGlobalVars & JwtVariables }>(async (c, next) => {

  // Passing an empty async callback lets it execute its validation logic
  const authResponse = await builtinJwt(c, async () => {
  })

  // on fail, return a 401 Response early
  if (authResponse) {
    return authResponse
  }

  const payload = c.get('jwtPayload') as JWTPayload

  const user = {
    id: payload.sub,
    username: payload.username,
    admin: payload.admin,
  }

  c.set('user', user)

  return await next()
})

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

  return jwtMiddleware(c, next)
})

