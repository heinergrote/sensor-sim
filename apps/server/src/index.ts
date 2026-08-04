import {WebSocketServer} from "ws";
import {applyWSSHandler, CreateWSSContextFnOptions} from "@trpc/server/adapters/ws";
import {CreateHTTPContextOptions, createHTTPServer} from "@trpc/server/adapters/standalone";
import cors, {CorsOptions} from 'cors';
import "dotenv/config";
import {SimState} from "@sensor-sim/shared";
import {appRouter} from "./appRouter";
import {simRegistry} from "./simulationRegistry";
import {Hono} from "hono";
import {serve} from "@hono/node-server";

const port = Number(process.env.PORT) || 3000;
const wsPort = Number(process.env.WSPORT) || 3001;
const restPort = Number(process.env.RESTPORT) || 4000;

// --------------------------------------------
// TRCP

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

// --------------------------------------------
// RAW WS

const rawWss = new WebSocketServer({port: wsPort});
console.log(`Raw WS Server running on port ${wsPort}`);

rawWss.on('connection', (ws, req) => {

  const url = new URL(req.url ?? '/', `ws://localhost`);
  const id = url.searchParams.get('id') ?? 'default';
  const sim = simRegistry.get(id, true);

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


// --------------------------------------------
// HONO REST

const app = new Hono();

app.get('/api/health', (c) =>
  c.json({status: "ok", uptime: process.uptime()})
);

app.get('/api/sims', (c) => {
  return c.json([...simRegistry.list()])
});

serve({
    fetch: app.fetch,
    port: restPort,
  }, (info) => {
    console.log(`REST Server running on port ${info.port}`)
  }
);


export type AppRouter = typeof appRouter;