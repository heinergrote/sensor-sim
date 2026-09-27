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
          console.log('ws opened for status events')
          for await (const data of stream) {
            ws.send(JSON.stringify(data));
          }
        },
        onClose: () => {
          console.log('ws closed for status events')
          abort.abort()
        },
      }
    })
  )

