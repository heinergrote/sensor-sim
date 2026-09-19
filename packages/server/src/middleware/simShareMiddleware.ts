import {createMiddleware} from "hono/factory";
import {verifyAndDecode} from "../token.service";
import {HonoEnv, simulationService} from "../index";


export const simShareMiddleware = createMiddleware<HonoEnv>(async (c, next) => {

  const token = c.req.param('token');
  if (!token) {
    return c.json({error: 'Token required'}, 400);
  }

  const decoded = verifyAndDecode(token);
  if (!decoded) {
    return c.json({error: 'Invalid or expired token.'}, 403);
  }

  const {resourceId, ownerId, expiryTimestamp, expiryDate} = decoded;

  const sim = simulationService.get(resourceId);
  if (!sim) {
    return c.json({error: 'Simulation not found'}, 404);
  }

  if (sim.config.shareToken !== token) {
    return c.json({error: 'Simulation is not shared under this token'}, 403);
  }
  
  if (sim.config.ownerId !== ownerId) {
    return c.json({error: 'You do not have permission to access this simulation.'}, 403);
  }

  const simStream = simulationService.getSimStream(sim.config.id);

  c.set('sim', sim)
  if (simStream) c.set('simStream', simStream)

  await next()

})
