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
          console.log('WS: client subscribed to sim list')
          for await (const data of stream) {
            ws.send(JSON.stringify(data));
          }
        },
        onMessage(event, _ws) {
          console.log(`Message from client: ${event.data}`)
        },
        onClose: () => {
          console.log(`WS: closing stream for sim list`);
          stream.return(undefined)
        },
      }
    })
  )

  .get('/:id', async (c, next) => {
      const simId = c.req.param('id') || ""
      const simStream = simulationService.getSimStream(simId);

      if (!simStream) {
        return c.text('WS: sim not found: ' + simId, 404);
      }
      c.set('simId', simId)
      c.set('simStream', simStream)
      await next()
    },

    upgradeWebSocket(async (c) => {

      const simId = c.get('simId') as string;
      const simStream = c.get('simStream') as EventStream<Simulation>;
      const simStreamGenerator = simStream.collect();

      return {
        onOpen: async (event, ws) => {
          console.log('WS: client subscribed to sim details: ', simId)
          for await (const data of simStreamGenerator) {
            ws.send(JSON.stringify(data));
          }
        },
        onMessage(event, ws) {
          console.log(`Message from client: ${event.data}`)
        },
        onClose: async () => {
          console.log('WS: closing stream for sim details, simId: ', simId);
          await simStreamGenerator.return(undefined)
        },
      }
    })
  )

export default app