import {Hono} from "hono";
import {upgradeWebSocket} from "@hono/node-server";
import {EventStream} from "../util/eventStream";
import {Simulation} from "../types";
import {simulationService} from "../index";

type Vars = {
  simId: string,
  simStream: EventStream<Simulation>
}

const app = new Hono<{ Variables: Vars }>()

  .get('/',

    upgradeWebSocket((c) => {
      const stream = simulationService.simListStream.collect()
      return {
        onOpen: async (_event, ws) => {
          for await (const data of stream) {
            ws.send(JSON.stringify(data));
          }
        },
        onClose: () => {
          stream.return(undefined)
        },
      }
    })
  )

  .get('/:id',

    async (c, next) => {
      const simId = c.req.param('id') || ""
      const simStream = simulationService.getSimStream(simId);

      if (!simStream) {
        return c.text('sim not found: ' + simId, 404);
      }
      c.set('simStream', simStream)
      await next()
    },

    upgradeWebSocket(async (c) => {
      const simStream = c.get('simStream') as EventStream<Simulation>;
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

export default app