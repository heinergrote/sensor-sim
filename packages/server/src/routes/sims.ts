import {Hono} from 'hono'
import {Simulation, simulationService} from "../index";
import {zValidator} from "@hono/zod-validator";
import {positionInput, simConfigInput, simCreateInput} from "../zodSchema";
import {jwtMiddleware} from "../middleware/auth";
import {HonoEnv, JWTPayload} from "../types";
import {generateToken} from "../token.service";
import {EventStream} from "../util/eventStream";
import {upgradeWebSocket} from "@hono/node-server";


export const simsApp = new Hono<HonoEnv>()

  .use('*', jwtMiddleware)

  .get('/', (c) => {
    return c.json([...simulationService.list()]);
  })

  .get('/:id', (c) => {
    const id = c.req.param('id');
    const sim = simulationService.get(id);
    if (!sim) {
      return c.json({error: 'Simulation not found'}, 404);
    }
    return c.json(sim);
  })

  .get('/:id/ws',

    async (c, next) => {
      const simId = c.req.param('id') || ""
      const sim = simulationService.get(simId);
      const simStream = simulationService.getSimStream(simId);

      if (!sim || !simStream) {
        return c.text('sim not found: ' + simId, 404);
      }
      c.set('sim', sim)
      c.set('simStream', simStream)
      await next()
    },

    upgradeWebSocket(async (c) => {
      const simStream = c.get('simStream') as EventStream<Simulation>;
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
    const payload = c.get('jwtPayload') as JWTPayload

    const result = await simulationService.createSim(payload.sub, input)
    return c.json(result)
  })

  .put('/:id', zValidator('json', simConfigInput), async (c) => {
    const id = c.req.param('id');
    const sim = simulationService.get(id);
    if (!sim) {
      return c.json({error: 'Simulation not found'}, 404);
    }
    const input = c.req.valid('json')
    await simulationService.update(id, input)
    return c.json({success: true})
  })

  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    const sim = simulationService.get(id);
    if (!sim) {
      return c.json({error: 'Simulation not found'}, 404);
    }
    await simulationService.remove(id)
    return c.json({success: true})
  })

  .put('/:id/updateCurrent', zValidator('json', positionInput), async (c) => {
    const id = c.req.param('id');
    const sim = simulationService.get(id);
    if (!sim) {
      return c.json({error: 'Simulation not found'}, 404);
    }
    const input = c.req.valid('json')
    await simulationService.updateCurrent(id, input)
    return c.json({success: true})
  })

  .put('/:id/start', async (c) => {
    const id = c.req.param('id');
    const sim = simulationService.get(id);
    if (!sim) {
      return c.json({error: 'Simulation not found'}, 404);
    }
    await simulationService.startSim(id)
    return c.json({success: true})
  })

  .put('/:id/stop', async (c) => {
    const id = c.req.param('id');
    const sim = simulationService.get(id);
    if (!sim) {
      return c.json({error: 'Simulation not found'}, 404);
    }
    await simulationService.stopSim(id)
    return c.json({success: true})
  })

  .post('/:id/share', async (c) => {
    const id = c.req.param('id');
    const sim = simulationService.get(id);
    if (!sim) {
      return c.json({error: 'Simulation not found'}, 404);
    }

    const jwtPayload = c.get('jwtPayload');
    const userId = jwtPayload.sub;

    const isOwner = sim.config.ownerId === userId;
    if (!isOwner) return c.json({error: 'Not owner'}, 403);

    const expiryTimestamp = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
    const {token, expiryDate} = generateToken(id, userId, expiryTimestamp);

    await simulationService.update(id, {shareToken: token});

    return c.json({token, expiryDate});
  })

  .post('/:id/unshare', async (c) => {
    const id = c.req.param('id');
    const sim = simulationService.get(id);
    if (!sim) {
      return c.json({error: 'Simulation not found'}, 404);
    }
    await simulationService.update(id, {shareToken: ""});
    return c.json({success: true});
  })
