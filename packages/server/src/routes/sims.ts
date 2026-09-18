import {Hono} from 'hono'
import {simulationService} from "../index";
import {zValidator} from "@hono/zod-validator";
import {positionInput, simConfigInput, simCreateInput} from "../zodSchema";
import {authMiddleware, createShareToken} from "../middleware/auth";
import {HonoEnv, JWTPayload} from "../types";

export const simsApp = new Hono<HonoEnv>()

  .use('*', authMiddleware)

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

    const token = createShareToken(id, userId);

    return c.json({token});
  })
