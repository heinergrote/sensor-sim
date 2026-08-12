import "dotenv/config";
import {initTrpcServer} from "./trcp/trpcServer";
import {appRouter} from "./trcp/appRouter";
import {initWsServer} from "./ws/wsServer";
import {initRestServer} from "./rest/restServer";
import {createSimRegistry} from "./simConfigRegistry";

const trcpPort = Number(process.env.TRCP_PORT) || 4000;
const wsPort = Number(process.env.WS_PORT) || 4001;
const restPort = Number(process.env.REST_PORT) || 4002;

initTrpcServer(trcpPort);
initWsServer(wsPort);
initRestServer(restPort);

export const simConfigRegistry = createSimRegistry();

export type AppRouter = typeof appRouter;

