import {Hono} from 'hono'
import {jwtMiddleware} from '../middleware/auth'
import {JWTPayload, Profile} from '../types'

export const meApp = new Hono()

  .use('*', jwtMiddleware)

  .get('/', (c) => {
    // Retrieve decoded payload attached by the middleware
    const payload = c.get('jwtPayload') as JWTPayload

    const profile: Profile = {
      id: payload.sub,
      username: payload.username,
      exp: payload.exp,
      admin: payload.admin,
    }

    return c.json(profile)
  })

