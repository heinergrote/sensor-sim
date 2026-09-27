import {Hono} from "hono";
import {simShareMiddleware} from "../middleware/simShareMiddleware";
import {upgradeWebSocket} from "@hono/node-server";
import {SimulationRunner} from "../simengine/simulationRunner";

export const sharedApp = new Hono()

  .use("/:token/*", simShareMiddleware)

  .get('/:token', (c) => {
    const simRunner = c.get('simRunner') as SimulationRunner;
    if (!simRunner) {
      return c.json({error: 'Simulation not found'}, 500);
    }
    return c.json(simRunner.simState);
  })

  .get('/:token/ws', (c) => {
    const simRunner = c.get('simRunner')
    const abort = new AbortController()
    const simStreamGenerator = simRunner.simStateStream.collect(abort.signal)
    return upgradeWebSocket(c, {
      onOpen: async (_event, ws) => {
        for await (const data of simStreamGenerator) ws.send(JSON.stringify(data))
      },
      onClose: () => abort.abort(),
    })
  })









