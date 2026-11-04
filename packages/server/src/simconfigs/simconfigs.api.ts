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
import {
  CONFIG_REVISION_HEADER,
  createSimConfigSchema,
  simConfigIdParam,
  updateSimConfigSchema,
  updateTypeSchema
} from "@sensor-sim/shared";
import {createMiddleware} from "hono/factory";
import {toCreate, toDto, toUpdate} from "./simconfigs.mapping";
import {sendStatusMessage} from "../status/status.service";
import {HonoSimConfigsVars} from "../types";
import {customAlphabet} from "nanoid";
import {TOKEN_SEP} from "../middleware/simShareMiddleware";
import {simulationDefinitions} from "../simulation/simulationDefinitions";

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


// Per-user config revision: bumped after every write, sent with the status message and as a header on
// `GET /`, so clients can skip refetching a list they already have. Kept in memory; time-based so it keeps
// increasing across server restarts (clients also revalidate on reconnect).
const revisions = new Map<number, number>()

function bumpRevision(userId: number) {
  const revision = Math.max(Date.now(), (revisions.get(userId) ?? 0) + 1)
  revisions.set(userId, revision)
  return revision
}

// per user: a pending message for one user must not be delayed or swallowed by another user's changes
const messageTimeouts = new Map<number, NodeJS.Timeout>()

async function handleSimConfigsUpdate(userId: number) {
  await simulationEngine.syncConfigs()
  // bump only after the write, so a list read after this revision is visible already contains the change
  const revision = bumpRevision(userId)
  // send the status update message to the owner's clients, with a 500ms delay
  // if there is already one waiting, clear and reschedule (the latest revision wins)
  clearTimeout(messageTimeouts.get(userId))
  messageTimeouts.set(userId, setTimeout(() => {
    messageTimeouts.delete(userId)
    sendStatusMessage(userId, {type: "configUpdate", revision})
  }, 500))
}

export const simConfigsApp = new Hono<{
  Variables: HonoSimConfigsVars;
}>()

  .use('*', jwtMiddleware)
  .use('/:id/*', loadOwnedSimConfig)

  .get('/', async (c) => {
    const user = c.get('user')
    // read the revision *before* the DB: the list is then at least that new (at worst one extra refetch)
    const revision = revisions.get(user.id) ?? 0
    const configs = await getSimConfigsOfUser(user.id)
    c.header(CONFIG_REVISION_HEADER, String(revision))
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
      await handleSimConfigsUpdate(c.var.user.id)

      return c.json(toDto(result))
    })

  .patch('/:id', zValidator('json', updateSimConfigSchema), async (c) => {
    const json = c.req.valid('json')
    const updateInput = toUpdate(json)

    const simConfig = c.get('simConfig')
    const result = await updateSimConfig(simConfig.id, updateInput)

    await handleSimConfigsUpdate(c.var.user.id)
    return c.json(toDto(result))
  })

  .delete('/:id', async (c) => {
    const simConfig = c.get('simConfig')
    const [deletedConfig] = await deleteSimConfig(simConfig.id)

    await handleSimConfigsUpdate(c.var.user.id)
    return c.json(toDto(deletedConfig))
  })

  .put('/:id/type', zValidator('json', updateTypeSchema), async (c) => {
    const simConfig = c.get('simConfig')
    const json = c.req.valid('json')

    // no change: just return
    if (simConfig.spec?.type === json.type)
      return c.json(toDto(simConfig));

    const pos = simConfig.spec ? simulationDefinitions.getLocation(simConfig.spec) : undefined

    const newSpec = simulationDefinitions.getDefaultSpec(json.type, pos)
    const updateInput = toUpdate({spec: newSpec})
    const result = await updateSimConfig(simConfig.id, updateInput)

    await handleSimConfigsUpdate(c.var.user.id)
    return c.json(toDto(result))
  })

  .put('/:id/start', async (c) => {
    const simConfig = c.get('simConfig')
    await updateSimConfig(simConfig.id, {playing: true})

    await handleSimConfigsUpdate(c.var.user.id)
    return c.json({success: true})
  })

  .put('/:id/stop', async (c) => {
    const simConfig = c.get('simConfig')
    await updateSimConfig(simConfig.id, {playing: false})

    await handleSimConfigsUpdate(c.var.user.id)
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
    await handleSimConfigsUpdate(c.var.user.id)
    return c.json({token});
  })

  .post('/:id/unshare', async (c) => {
    const simConfig = c.get('simConfig')
    await updateSimConfig(simConfig.id, {
      shareToken: ""
    });
    await handleSimConfigsUpdate(c.var.user.id)
    return c.json({success: true});
  })
