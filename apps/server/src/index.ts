import {appRouter} from "./appRouter";
import {startSimulation} from "./sim";
import {WebSocketServer} from "ws";
import {applyWSSHandler, CreateWSSContextFnOptions} from "@trpc/server/adapters/ws";
import {CreateHTTPContextOptions, createHTTPServer} from "@trpc/server/adapters/standalone";
import cors, {CorsOptions} from 'cors';
import "dotenv/config";

export const createContext = (
  _opts: CreateHTTPContextOptions | CreateWSSContextFnOptions
) => {
  return {name: "sim"};
};
export type Context = Awaited<ReturnType<typeof createContext>>;


var corsOptions: CorsOptions = {
  origin: ["*", "http://localhost:5173"]
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
  console.log(`++ Connection (${wss.clients.size})`);
  ws.once('close', () => {
    console.log(`-- Connection (${wss.clients.size})`);
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM');
  handler.broadcastReconnectNotification();
  wss.close();
});

server.listen(process.env.PORT || 3000);

startSimulation()

console.log(`Server running on port ${process.env.PORT || 3000}`);

export type {AppRouter} from './appRouter';