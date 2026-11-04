import {Hono} from "hono";
import {upgradeWebSocket} from "@hono/node-server";
import {jwtMiddleware, wsJwtMiddleware} from "../middleware/jwtAuth";
import {getStatusStream} from "./status.service";
import {HonoGlobalVars} from "../types";

export const statusApp = new Hono<{ Variables: HonoGlobalVars }>()

  .use('/ws', wsJwtMiddleware)
  .use(jwtMiddleware)

  .get('/',
    (c) => c.json(getStatusStream(c.var.user.id).get())
  )

  .get('/ws',
    upgradeWebSocket((c) => {
      const abort = new AbortController();
      const stream = getStatusStream(c.var.user.id).collect(abort.signal)
      return {
        onOpen: async (_event, ws) => {
          for await (const data of stream) {
            ws.send(JSON.stringify(data));
          }
          ws.close()
        },
        onClose: () => {
          abort.abort()
        },
      }
    })
  )

