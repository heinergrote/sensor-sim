import {Hono} from "hono";
import {createFactory} from "hono/factory";
import {simShareMiddleware} from "../middleware/simShareMiddleware";
import {upgradeWebSocket} from "@hono/node-server";
import {HonoSimRunnerVars} from "../types";

// WebSocket clients get the live stream; upgradeWebSocket calls next() for any other request,
// which falls through to the JSON handler.
const sharedSimHandlers = createFactory<{ Variables: HonoSimRunnerVars }>().createHandlers(
  simShareMiddleware,
  upgradeWebSocket((c) => {
    const simRunner = c.get('simRunner')
    const abort = new AbortController()
    return {
      onOpen: async (_event, ws) => {
        const simDataUpdates = simRunner.simDataStream.collect(abort.signal)
        for await (const simData of simDataUpdates) {
          ws.send(JSON.stringify(simData))
        }
        ws.close()
      },
      onClose: () => abort.abort(),
    }
  }),
  (c) => c.json(c.get('simRunner').simData),
)

export const sharedApp = new Hono()
  .get('/:token', ...sharedSimHandlers)
  // Legacy alias, kept for existing clients — same handlers, so it also answers plain GETs with JSON.
  .get('/:token/ws', ...sharedSimHandlers)
