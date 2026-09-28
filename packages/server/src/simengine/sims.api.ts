import {Hono} from 'hono'
import {simulationEngine} from "../index";
import {jwtMiddleware, wsJwtMiddleware} from "../middleware/jwtAuth";
import {upgradeWebSocket} from "@hono/node-server";
import {withOwnSimMiddleware} from "../middleware/withOwnSim";
import {HonoSimRunnerVars} from "../types";


export const simsApp = new Hono<{
  Variables: HonoSimRunnerVars;
}>()

  .use('/:id/ws', wsJwtMiddleware)
  .use('*', jwtMiddleware)
  .use('/:id/*', withOwnSimMiddleware())

  .get('/', (c) => {
    const user = c.get('user')
    const usersSimStates = simulationEngine.list(user.id).map((simRunner) => simRunner.simState)
    return c.json(usersSimStates);
  })

  .get('/:id', (c) => {
    const simRunner = c.get('simRunner')
    return c.json(simRunner.simState);
  })

  .get('/:id/ws', (c) => {
    const simRunner = c.get('simRunner')
    const abort = new AbortController()
    const simStreamGenerator = simRunner.simStateStream.collect(abort.signal)
    return upgradeWebSocket(c, {
      onOpen: async (_event, ws) => {
        for await (const data of simStreamGenerator) ws.send(JSON.stringify(data))
      },
      onClose: () => {
        abort.abort()
      },
    })
  })
