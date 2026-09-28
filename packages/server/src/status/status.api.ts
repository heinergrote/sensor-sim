import {Hono} from "hono";
import {upgradeWebSocket} from "@hono/node-server";
import {jwtMiddleware, wsJwtMiddleware} from "../middleware/jwtAuth";
import {statusStream} from "./status.service";

export const statusApp = new Hono()

  .use('/ws', wsJwtMiddleware)
  .use(jwtMiddleware)

  .get('/',
    (c) => c.json(statusStream.get())
  )

  .get('/ws',
    upgradeWebSocket((c) => {
      const abort = new AbortController();
      const stream = statusStream.collect(abort.signal)
      return {
        onOpen: async (_event, ws) => {
          for await (const data of stream) {
            ws.send(JSON.stringify(data));
          }
        },
        onClose: () => {
          abort.abort()
        },
      }
    })
  )

