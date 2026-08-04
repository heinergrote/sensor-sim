import {WebSocketServer} from "ws";
import {applyWSSHandler} from "@trpc/server/adapters/ws";
import {createHTTPServer} from "@trpc/server/adapters/standalone";
import cors, {CorsOptions} from "cors";
import {appRouter} from "./appRouter";
import {createContext} from "./trpcContext";

const corsOptions: CorsOptions = {origin: "*"};

export function initTrpcServer(port: number) {

  const server: ReturnType<typeof createHTTPServer> = createHTTPServer({
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

  return {server, wss};
}
