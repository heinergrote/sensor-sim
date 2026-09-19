import {Hono} from "hono";
import {upgradeWebSocket} from "@hono/node-server";
import {simulationService} from "../index";
import {jwtMiddleware} from "../middleware/auth";

export const statusApp = new Hono()

  .use(jwtMiddleware)

  .get('/',
    (c) => c.json(simulationService.status)
  )

  .get('/ws',
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

