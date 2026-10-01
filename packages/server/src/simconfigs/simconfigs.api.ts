import {Hono} from 'hono'
import {simulationEngine} from "../index";
import {zValidator} from "@hono/zod-validator";
import {jwtMiddleware} from "../middleware/jwtAuth";
import {
  deleteSimConfig,
  getSimConfigById,
  getSimConfigsOfUser,
  insertSimConfig,
  updateSimConfig
} from "./simconfigs.repository";
import {createSimConfigSchema, simConfigIdParam, updateSimConfigSchema} from "@sensor-sim/shared";
import {createMiddleware} from "hono/factory";
import {toCreate, toDto, toUpdate} from "./simconfigs.mapping";
import {sendStatusMessage} from "../status/status.service";
import {HonoSimConfigsVars} from "../types";
import {customAlphabet} from "nanoid";
import {TOKEN_SEP} from "../middleware/simShareMiddleware";

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


let messageTimeout: NodeJS.Timeout | undefined

async function handleSimConfigsUpdate() {
  await simulationEngine.syncConfigs()
  // send the status update message, with a 500ms delay
  // if there is already one waiting, clear and reschedule
  if (messageTimeout) {
    clearTimeout(messageTimeout)
  }
  messageTimeout = setTimeout(() => {
    sendStatusMessage({type: "configUpdate", updatedAt: Date.now()})
  }, 500)
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
      const newSimConfig = toCreate(json, user.id)

      const result = await insertSimConfig(user.id, newSimConfig)
      await handleSimConfigsUpdate()

      return c.json(toDto(result))
    })

  .patch('/:id', zValidator('json', updateSimConfigSchema), async (c) => {
    const json = c.req.valid('json')
    const updateInput = toUpdate(json)

    const simConfig = c.get('simConfig')
    const result = await updateSimConfig(simConfig.id, updateInput)

    await handleSimConfigsUpdate()
    return c.json(toDto(result))
  })

  .delete('/:id', async (c) => {
    const simConfig = c.get('simConfig')
    const [deletedConfig] = await deleteSimConfig(simConfig.id)

    await handleSimConfigsUpdate()
    return c.json(toDto(deletedConfig))
  })

  .put('/:id/start', async (c) => {
    const simConfig = c.get('simConfig')
    await updateSimConfig(simConfig.id, {playing: true})

    await handleSimConfigsUpdate()
    return c.json({success: true})
  })

  .put('/:id/stop', async (c) => {
    const simConfig = c.get('simConfig')
    await updateSimConfig(simConfig.id, {playing: false})

    await handleSimConfigsUpdate()
    return c.json({success: true})
  })

  .post('/:id/share', async (c) => {
    const simConfig = c.get('simConfig')

    const nanoIdAlphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nanoid = customAlphabet(nanoIdAlphabet, 10);

    const token = simConfig.id + TOKEN_SEP + nanoid()
    await updateSimConfig(simConfig.id, {
      shareToken: token
    });
    await handleSimConfigsUpdate()
    return c.json({token});
  })

  .post('/:id/unshare', async (c) => {
    const simConfig = c.get('simConfig')
    await updateSimConfig(simConfig.id, {
      shareToken: ""
    });
    await handleSimConfigsUpdate()
    return c.json({success: true});
  })
