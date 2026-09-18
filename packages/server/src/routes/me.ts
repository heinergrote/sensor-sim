import {Hono} from 'hono'
import {authMiddleware} from '../middleware/auth'
import {JwtPayload} from '../types'

const app = new Hono()

  .use('*', authMiddleware)

  .get('/', (c) => {
    // Retrieve decoded payload attached by the middleware
    const payload = c.get('jwtPayload') as JwtPayload

    return c.json({
      id: payload.sub,
      username: payload.username,
      exp: payload.exp,
      admin: payload.admin,
    })
  })

export default app
