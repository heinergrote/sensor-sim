import {WebSocketServer} from "ws";
import {applyWSSHandler, CreateWSSContextFnOptions} from "@trpc/server/adapters/ws";
import {CreateHTTPContextOptions, createHTTPServer} from "@trpc/server/adapters/standalone";
import cors, {CorsOptions} from 'cors';
import "dotenv/config";
import {SimState} from "@sensor-sim/shared";
import {getSim} from "./sim";
import {appRouter} from "./appRouter";

const port = Number(process.env.PORT) || 3000;
const wsPort = Number(process.env.WSPORT) || 3001;

export const createContext = (
  _opts: CreateHTTPContextOptions | CreateWSSContextFnOptions
) => ({});
export type Context = Awaited<ReturnType<typeof createContext>>;

const corsOptions: CorsOptions = {
  origin: "*"
}

const server = createHTTPServer({
  router: appRouter,
  createContext,
  middleware: cors(corsOptions),
});

const wss = new WebSocketServer({server});

const handler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext,
  keepAlive: {
    enabled: true,
    pingMs: 30000,
    pongWaitMs: 5000,
  },
});

wss.on('connection', (ws) => {
  console.log(`trpc ws client added (${wss.clients.size})`);
  ws.once('close', () => {
    console.log(`trpc ws client removed (${wss.clients.size})`);
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM');
  handler.broadcastReconnectNotification();
  wss.close();
});

server.listen(port);
console.log(`Server running on port ${port}`);

const rawWss = new WebSocketServer({port: wsPort});
console.log(`Raw WS Server running on port ${wsPort}`);

rawWss.on('connection', (ws, req) => {

  const url = new URL(req.url ?? '/', `ws://localhost`);
  const id = url.searchParams.get('id') ?? 'default';
  const sim = getSim(id);

  // send current state on connect
  ws.send(JSON.stringify(sim.simState));

  const listenerFn = (data: SimState) => {
    ws.send(JSON.stringify(data));
  }
  sim.addListener(listenerFn);

  ws.on('close', () => {
    sim.removeListener(listenerFn)
  });
});

export type AppRouter = typeof appRouter;