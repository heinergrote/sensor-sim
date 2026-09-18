import {Hono} from "hono";
import {upgradeWebSocket} from "@hono/node-server";
import {EventStream} from "../util/eventStream";
import {Simulation} from "../types";
import {simulationService} from "../index";
import {verifyShareToken} from "../middleware/auth";

type Vars = {
  simId: string,
  simStream: EventStream<Simulation>
}

export const simsWebsocketApp = new Hono<{ Variables: Vars }>()

  .get('/status',

    upgradeWebSocket((c) => {
      const stream = simulationService.statusStream.collect()
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

  .get('/shared/:token', async (c) => {
    const token = c.req.param('token');
    if (!token) {
      return c.json({error: 'Token required'}, 400);
    }

    const payload = verifyShareToken(token);
    if (!payload) {
      return c.json({error: 'Invalid token.'}, 403);
    }

    const {resourceId, ownerId} = payload;

    const sim = simulationService.get(resourceId);
    if (!sim) {
      return c.json({error: 'Simulation not found'}, 404);
    }

    if (sim.config.ownerId !== ownerId) {
      return c.json({error: 'You do not have permission to access this simulation.'}, 403);
    }

    return c.json(sim);
  })


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
