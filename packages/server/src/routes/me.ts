import {Hono} from 'hono'
import {authMiddleware} from '../middleware/auth'
import {JWTPayload} from '../types'

export const meApp = new Hono()

  .use('*', authMiddleware)

  .get('/', (c) => {
    // Retrieve decoded payload attached by the middleware
    const payload = c.get('jwtPayload') as JWTPayload

    return c.json({
      id: payload.sub,
      username: payload.username,
      exp: payload.exp,
      admin: payload.admin,
    })
  })

