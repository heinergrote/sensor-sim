import "dotenv/config";
import {createSimulationService} from "./simulationService";
import {Hono} from "hono";
import {cors} from "hono/cors";
import maptilerApp from "./routes/maptiler";
import simsApp from "./routes/sims";
import simsWebsocketApp from "./routes/simsWebsocket";
import {WebSocketServer} from "ws";
import {serve} from "@hono/node-server";

console.log("Starting server -", process.env.NODE_ENV);

const restPort = Number(process.env.REST_PORT) || 4000;

export const simulationService = await createSimulationService()

const app = new Hono();

app.use(
  '*',
  cors({
    // Allows local testing in dev, but locks down to your real site in prod
    origin: process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://sensor-sim-web.h9e.de',
    credentials: true,
  })
)


app.route("/api/maptiler", maptilerApp)
app.route("/ws/sims", simsWebsocketApp)
const apiSimsRoutes = app.route('/api/sims', simsApp)

const wsServer = new WebSocketServer({
  noServer: true,
});

serve(
  {
    fetch: app.fetch,
    websocket: {server: wsServer},
    port: restPort,
  },
  (info) => console.log(`Server running on port ${info.port}`)
);

export type AppType = typeof apiSimsRoutes

export * from "./types";

