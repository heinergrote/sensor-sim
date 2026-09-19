import {Hono} from "hono";
import {HonoEnv, Simulation} from "../index";
import {simShareMiddleware} from "../middleware/simShareMiddleware";
import {upgradeWebSocket} from "@hono/node-server";
import {EventStream} from "../util/eventStream";

export const sharedApp = new Hono<HonoEnv>()

  .use("/:token/*", simShareMiddleware)

  .get('/:token', (c) => {
    const sim = c.get('sim');
    if (!sim) {
      return c.json({error: 'Simulation not found'}, 500);
    }
    return c.json(sim);
  })

  .get('/:token/ws',

    upgradeWebSocket(async (c) => {

      const simStream = c.var.simStream as EventStream<Simulation>;
      const simStreamGenerator = simStream.collect();


      return {
        onOpen: async (_event, ws) => {
          for await (const data of simStreamGenerator) {
            ws.send(JSON.stringify(data));
          }
        },
        onClose: async () => {
          await simStreamGenerator.return(undefined)
        },
      }
    })
  )









