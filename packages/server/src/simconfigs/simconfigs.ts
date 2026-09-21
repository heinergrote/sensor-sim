import {Hono} from 'hono'
import {HonoSimConfigsVars, User} from "../index";
import {zValidator} from "@hono/zod-validator";
import {jwtMiddleware} from "../middleware/jwtAuth";
import {generateToken} from "../token.service";
import {
  deleteSimConfig,
  getSimConfigById,
  getSimConfigsOfUser,
  insertSimConfig,
  updateSimConfig
} from "./simconfigs.repository";
import {createSimConfigBody, updateSimConfigBody} from "./simConfigsZodSchema";
import {createMiddleware} from "hono/factory";
import {toDto, toInsert} from "./mappings";


export const withOwnSimConfigMiddleware = (idParamKey: string = "id") => createMiddleware<{
  Variables: HonoSimConfigsVars
}>(async (c, next) => {

  const user = c.get('user') // Assumes auth middleware ran prior

  const id = c.req.param(idParamKey);
  if (!id) {
    return c.json({error: 'No id provided'}, 400);
  }

  const row = await getSimConfigById(id)
  if (!row) {
    return c.json({error: 'Simulation not found'}, 404);
  }

  const simConfig = toDto(row)

  if (simConfig.ownerId !== user.id) {
    return c.json({error: 'Unauthorized'}, 403)
  }

  c.set('simConfig', simConfig)

  await next()
})

export const simConfigsApp = new Hono<{
  Variables: HonoSimConfigsVars;
}>()

  .use('*', jwtMiddleware)
  .use('/:id/*', withOwnSimConfigMiddleware())


  .get('/', (c) => {
    const user = c.get('user') as User
    const config = getSimConfigsOfUser(user.id)
    return c.json(config);
  })

  .get('/:id', (c) => {
    const simConfig = c.get('simConfig')
    return c.json(simConfig);
  })

  .post('/',
    zValidator('json', createSimConfigBody),
    async (c) => {
      const json = c.req.valid('json')
      const user = c.get('user') as User

      const newSimConfig = toInsert(json, user.id)
      const result = await insertSimConfig(user.id, newSimConfig)

      return c.json(toDto(result))
    })

  .patch('/:id', zValidator('json', updateSimConfigBody), async (c) => {
    const input = c.req.valid('json')
    const simConfig = c.get('simConfig')
    await updateSimConfig(simConfig.id, input)
    return c.json({success: true})
  })

  .delete('/:id', async (c) => {
    const simConfig = c.get('simConfig')
    await deleteSimConfig(simConfig.id)
    return c.json({success: true})
  })

  // .put('/:id/updateCurrent', zValidator('json', updatePositionBody), async (c) => {
  //   const simConfig = c.get('simConfig')
  //   const input = c.req.valid('json')
  //   // TODO: update config and runtime
  //   return c.json({success: true})
  // })

  // .put('/:id/start', async (c) => {
  //   const sim = c.get('sim')
  //   await simulationService.startSim(sim.config.id)
  //   return c.json({success: true})
  // })
  //
  // .put('/:id/stop', async (c) => {
  //   const sim = c.get('sim')
  //   await simulationService.stopSim(sim.config.id)
  //   return c.json({success: true})
  // })

  .post('/:id/share', async (c) => {
    const simConfig = c.get('simConfig')
    const user = c.get('user')

    const expiryTimestamp = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
    const {token, expiryDate} = generateToken(simConfig.id, user.id, expiryTimestamp);
    await updateSimConfig(simConfig.id, {
      shareToken: token
    });
    return c.json({token, expiryDate});
  })

  .post('/:id/unshare', async (c) => {
    const simConfig = c.get('simConfig')
    await updateSimConfig(simConfig.id, {
      shareToken: ""
    });
    return c.json({success: true});
  })
