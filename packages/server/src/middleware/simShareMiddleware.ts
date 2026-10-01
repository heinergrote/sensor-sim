import {createMiddleware} from "hono/factory";
import {simulationEngine} from "../index";
import {HonoSimRunnerVars} from "../types";
import {getSimConfigById} from "../simconfigs/simconfigs.repository";

export const TOKEN_SEP = "!"

export const simShareMiddleware = createMiddleware<{ Variables: HonoSimRunnerVars }>(async (c, next) => {

  const token = c.req.param('token');
  if (!token) {
    return c.json({error: 'Token required'}, 400);
  }

  const [resourceIdString, _rest] = token.split(TOKEN_SEP)
  const resourceId = parseInt(resourceIdString)
  if (!resourceId || isNaN(resourceId) || !_rest) {
    return c.json({error: 'Invalid token'}, 400);
  }

  const simConfig = await getSimConfigById(resourceId)
  if (!simConfig) {
    return c.json({error: 'Simulation not found'}, 404);
  }

  if (simConfig.shareToken !== token) {
    return c.json({error: 'Simulation is not shared under this token'}, 403);
  }

  const simRunner = simulationEngine.get(resourceId);
  if (!simRunner) {
    return c.json({error: 'Simulation not found'}, 404);
  }

  c.set('simRunner', simRunner)

  await next()

})
