import {createMiddleware} from "hono/factory";
import {HonoSimRunnerVars} from "../types";
import {simulationEngine} from "../index";


export const withOwnSimMiddleware = (idParamKey: string = "id") => createMiddleware<{
  Variables: HonoSimRunnerVars
}>(async (c, next) => {

  const user = c.get('user') // Assumes auth middleware ran prior

  const id = Number(c.req.param(idParamKey));
  if (!id) {
    return c.json({error: 'No id provided'}, 400);
  }

  const simRunner = simulationEngine.get(id);
  if (!simRunner) {
    return c.json({error: 'Simulation not found'}, 404);
  }

  if (simRunner.config.ownerId !== user.id) {
    return c.json({error: 'Unauthorized'}, 403)
  }

  c.set('simRunner', simRunner)

  await next()
})