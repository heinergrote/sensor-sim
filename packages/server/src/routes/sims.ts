import {Hono} from 'hono'
import {simulationService} from "../index";
import {zValidator} from "@hono/zod-validator";
import {simConfigInput, simIdInput, simUpdateCurrentInput, simUpdateTargetInput} from "../schema";

const app = new Hono()

app.get('/', (c) => {
  return c.json([...simulationService.list()]);
})

app.get('/:id', (c) => {
  const id = c.req.param('id');
  const sim = simulationService.get(id);
  if (!sim) {
    return c.json({error: 'Simulation not found'}, 404);
  }
  return c.json(sim);
})

app.get('/list', (c) => {
  const sims = simulationService.list()
  return c.json(sims)
})

app.post('/create', zValidator('json', simConfigInput), async (c) => {
  const input = c.req.valid('json')
  console.log("createSim", input)
  const result = await simulationService.create(input)
  return c.json(result)
})

app.post('/updateTarget', zValidator('json', simUpdateTargetInput), async (c) => {
  const input = c.req.valid('json')
  await simulationService.updateTarget(input)
  return c.json({success: true})
})

app.post('/updateCurrent', zValidator('json', simUpdateCurrentInput), async (c) => {
  const input = c.req.valid('json')
  await simulationService.updateCurrent(input)
  return c.json({success: true})
})

app.post('/delete', zValidator('json', simIdInput), async (c) => {
  const input = c.req.valid('json')
  await simulationService.remove(input.id)
  return c.json({success: true})
})

app.post('/start', zValidator('json', simIdInput), async (c) => {
  const input = c.req.valid('json')
  const result = await simulationService.startSim(input.id)
  return c.json(result)
})

app.post('/stop', zValidator('json', simIdInput), async (c) => {
  const input = c.req.valid('json')
  await simulationService.stopSim(input.id)
  return c.json({success: true})
})

export default app