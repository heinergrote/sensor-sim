import {createMiddleware} from "hono/factory";
import {HonoSimVars} from "../types";
import {simulationService} from "../index";


export const withOwnSimMiddleware = (idParamKey: string = "id") => createMiddleware<{
  Variables: HonoSimVars
}>(async (c, next) => {

  const user = c.get('user') // Assumes auth middleware ran prior

  const id = c.req.param(idParamKey);
  if (!id) {
    return c.json({error: 'No id provided'}, 400);
  }

  const sim = simulationService.get(id);
  if (!sim) {
    return c.json({error: 'Simulation not found'}, 404);
  }
  const simStream = simulationService.getSimStream(id);

  if (sim.config.ownerId !== user.id) {
    return c.json({error: 'Unauthorized'}, 403)
  }

  c.set('sim', sim)
  if (simStream) c.set('simStream', simStream)

  await next()
})