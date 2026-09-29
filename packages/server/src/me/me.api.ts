import {Hono} from 'hono'
import {jwtMiddleware} from '../middleware/jwtAuth'
import {HonoGlobalVars} from '../types'
import {Profile} from "@sensor-sim/shared";

export const meApp = new Hono<{ Variables: HonoGlobalVars }>()

  .use('*', jwtMiddleware)

  .get('/', (c) => {
    // Retrieve decoded payload attached by the middleware
    const user = c.get('user')

    const profile: Profile = {
      id: user.id,
      username: user.username,
      admin: user.admin,
    }

    return c.json(profile)
  })

