import {Hono} from 'hono'
import {HonoSimConfigsVars, simulationEngine} from "../index";
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
import {createSimConfigSchema, positionSchema, simConfigIdParam, updateSimConfigSchema} from "./simconfigs.schemas";
import {createMiddleware} from "hono/factory";
import {toDto, toInsert, toUpdate} from "./mappings";
import {sendStatusMessage} from "../status/status.service";


const loadOwnedSimConfig = createMiddleware<{
  Variables: HonoSimConfigsVars
}>(async (c, next) => {

  const paramParsed = simConfigIdParam.safeParse(c.req.param());
  if (!paramParsed.success) {
    return c.json({error: 'Invalid ID format'}, 400);
  }
  const {id} = paramParsed.data;

  const simConfigRow = await getSimConfigById(id)
  if (!simConfigRow) {
    return c.json({error: 'Simulation not found'}, 404);
  }

  const user = c.var.user
  if (simConfigRow.ownerId !== user.id) {
    return c.json({error: 'Unauthorized'}, 403)
  }

  c.set('simConfig', simConfigRow)

  await next()
})

function handleSimConfigsUpdate() {
  sendStatusMessage({type: "configUpdate", updatedAt: Date.now()})
  simulationEngine.syncConfigs()
}

export const simConfigsApp = new Hono<{
  Variables: HonoSimConfigsVars;
}>()

  .use('*', jwtMiddleware)
  .use('/:id/*', loadOwnedSimConfig)

  .get('/', async (c) => {
    const user = c.get('user')
    const configs = await getSimConfigsOfUser(user.id)
    return c.json(configs.map(toDto));
  })

  .get('/:id', (c) => {
    const simConfig = c.get('simConfig')
    return c.json(toDto(simConfig));
  })

  .post('/',
    zValidator('json', createSimConfigSchema),
    async (c) => {
      const user = c.get('user')

      const json = c.req.valid('json')
      const newSimConfig = toInsert(json, user.id)

      const result = await insertSimConfig(user.id, newSimConfig)

      handleSimConfigsUpdate()

      return c.json(toDto(result))
    })

  .patch('/:id', zValidator('json', updateSimConfigSchema), async (c) => {
    const json = c.req.valid('json')
    const updateInput = toUpdate(json)

    const simConfig = c.get('simConfig')
    const result = await updateSimConfig(simConfig.id, updateInput)

    handleSimConfigsUpdate()
    return c.json(toDto(result))
  })

  .delete('/:id', async (c) => {
    const simConfig = c.get('simConfig')
    const [deletedConfig] = await deleteSimConfig(simConfig.id)

    handleSimConfigsUpdate()
    return c.json(toDto(deletedConfig))
  })

  .put('/:id/updateCurrent', zValidator('json', positionSchema), async (c) => {
    const simConfig = c.get('simConfig')
    const input = c.req.valid('json')
    // TODO: update config and runtime

    handleSimConfigsUpdate()
    return c.json({success: true})
  })

  .put('/:id/start', async (c) => {
    const simConfig = c.get('simConfig')
    await updateSimConfig(simConfig.id, {playing: true})

    handleSimConfigsUpdate()
    return c.json({success: true})
  })

  .put('/:id/stop', async (c) => {
    const simConfig = c.get('simConfig')
    await updateSimConfig(simConfig.id, {playing: false})

    handleSimConfigsUpdate()
    return c.json({success: true})
  })

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
