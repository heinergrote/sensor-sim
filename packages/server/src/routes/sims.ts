import {Hono} from 'hono'
import {simulationService} from "../index";
import {zValidator} from "@hono/zod-validator";
import {positionInput, simConfigInput, simCreateInput} from "../zodSchema";

const app = new Hono()

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

    // TODO: get ownerId from jwt payload!!!
    const result = await simulationService.createSim(1, input)
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
    const result = await simulationService.startSim(id)
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

export default app