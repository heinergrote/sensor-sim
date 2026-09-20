import {Hono} from 'hono'
import {HonoSimVars, simulationService, User} from "../index";
import {zValidator} from "@hono/zod-validator";
import {positionInput, simConfigInput, simCreateInput} from "../zodSchema";
import {jwtMiddleware, wsJwtMiddleware} from "../middleware/jwtAuth";
import {generateToken} from "../token.service";
import {upgradeWebSocket} from "@hono/node-server";
import {withOwnSimMiddleware} from "../middleware/withOwnSim";


export const simsApp = new Hono<{
  Variables: HonoSimVars;
}>()

  .use('/:id/ws', wsJwtMiddleware)
  .use('*', jwtMiddleware)
  .use('/:id/*', withOwnSimMiddleware())

  .get('/', (c) => {
    const user = c.get('user') as User
    return c.json([...simulationService.list(user.id)]);
  })

  .get('/:id', (c) => {
    const sim = c.get('sim')
    return c.json(sim);
  })

  .get('/:id/ws',

    upgradeWebSocket(async (c) => {
      const simStream = c.get('simStream');
      const simStreamGenerator = simStream.collect();

      return {
        onOpen: async (_event, ws) => {
          for await (const data of simStreamGenerator) {
            ws.send(JSON.stringify(data));
          }
        },
        onClose: async () => {
          await simStreamGenerator.return(undefined)
        },
      }
    })
  )

  .post('/', zValidator('json', simCreateInput), async (c) => {
    const input = c.req.valid('json')
    const user = c.get('user') as User

    const result = await simulationService.createSim(user.id, input)
    return c.json(result)
  })

  .put('/:id', zValidator('json', simConfigInput), async (c) => {
    const input = c.req.valid('json')
    const sim = c.get('sim')
    await simulationService.update(sim.config.id, input)
    return c.json({success: true})
  })

  .delete('/:id', async (c) => {
    const sim = c.get('sim')
    await simulationService.remove(sim.config.id)
    return c.json({success: true})
  })

  .put('/:id/updateCurrent', zValidator('json', positionInput), async (c) => {
    const sim = c.get('sim')
    const input = c.req.valid('json')
    await simulationService.updateCurrent(sim.config.id, input)
    return c.json({success: true})
  })

  .put('/:id/start', async (c) => {
    const sim = c.get('sim')
    await simulationService.startSim(sim.config.id)
    return c.json({success: true})
  })

  .put('/:id/stop', async (c) => {
    const sim = c.get('sim')
    await simulationService.stopSim(sim.config.id)
    return c.json({success: true})
  })

  .post('/:id/share', async (c) => {
    const sim = c.get('sim')
    const user = c.get('user')
    const expiryTimestamp = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
    const {token, expiryDate} = generateToken(sim.config.id, user.id, expiryTimestamp);
    await simulationService.share(sim.config.id, token);
    return c.json({token, expiryDate});
  })

  .post('/:id/unshare', async (c) => {
    const sim = c.get('sim')
    await simulationService.unshare(sim.config.id);
    return c.json({success: true});
  })
