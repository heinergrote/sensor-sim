import {Hono} from 'hono'
import {simulationService} from "../index";

const app = new Hono()

app.get('/', (c) => {
  return c.json([...simulationService.list()]);
});

app.get('/:id', (c) => {
  const id = c.req.param('id');
  const sim = simulationService.get(id);
  if (!sim) {
    return c.json({error: 'Simulation not found'}, 404);
  }
  return c.json(sim);
});


export default app