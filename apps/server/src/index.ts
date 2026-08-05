import "dotenv/config";
import {initTrpcServer} from "./trcp/trpcServer";
import {appRouter} from "./trcp/appRouter";
import {initWsServer} from "./ws/wsServer";
import {initRestServer} from "./rest/restServer";
import {createSimulationRegistry} from "./simulationRegistry";

const port = Number(process.env.PORT) || 4000;
const wsPort = Number(process.env.WSPORT) || 4001;
const restPort = Number(process.env.RESTPORT) || 4002;

initTrpcServer(port);
initWsServer(wsPort);
initRestServer(restPort);

export const simRegistry = createSimulationRegistry();

export type AppRouter = typeof appRouter;

