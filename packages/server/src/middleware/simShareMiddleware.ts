import {createMiddleware} from "hono/factory";
import {verifyAndDecode} from "../util/shareTokens";
import {simulationEngine} from "../index";
import {HonoSimRunnerVars} from "../types";

export const simShareMiddleware = createMiddleware<{ Variables: HonoSimRunnerVars }>(async (c, next) => {

  const token = c.req.param('token');
  if (!token) {
    return c.json({error: 'Token required'}, 400);
  }

  const decoded = verifyAndDecode(token);
  if (!decoded) {
    return c.json({error: 'Invalid or expired token.'}, 403);
  }

  const {resourceId, ownerId, expiryTimestamp, expiryDate} = decoded;

  const simRunner = simulationEngine.get(resourceId);
  if (!simRunner) {
    return c.json({error: 'Simulation not found'}, 404);
  }

  if (simRunner.config.shareToken !== token) {
    return c.json({error: 'Simulation is not shared under this token'}, 403);
  }

  if (simRunner.config.ownerId !== ownerId) {
    return c.json({error: 'You do not have permission to access this simulation.'}, 403);
  }

  c.set('simRunner', simRunner)

  await next()

})
