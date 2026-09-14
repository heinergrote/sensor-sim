import "dotenv/config";
import {existsSync} from "node:fs";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {createSimulationService} from "./simulations.service";
import {Hono} from "hono";
import {cors} from "hono/cors";
import maptilerApp from "./routes/maptiler";
import simsApp from "./routes/sims";
import usersApp from "./routes/users";
import simsWebsocketApp from "./routes/simsWebsocket";
import {WebSocketServer} from "ws";
import {serve} from "@hono/node-server";
import {serveStatic} from "@hono/node-server/serve-static";
import dbInit from "./db/dbInit";

console.log("Init DB", process.env.DATABASE_URL);

await dbInit()

console.log("Starting server -", process.env.NODE_ENV);

const port = Number(process.env.PORT) || 4000;

export const simulationService = await createSimulationService()

const app = new Hono();

if (process.env.NODE_ENV === 'development') {
  app.use(
    '*',
    cors({
      origin: 'http://localhost:3000',
      credentials: true,
    })
  )
}

const apiRoutes = app
  .route("/api/maptiler", maptilerApp)
  .route("/ws/sims", simsWebsocketApp)
  .route('/api/sims', simsApp)
  .route('/api/users', usersApp)

// Serve the built frontend from the same origin/process. Two possible
// locations, checked in order:
//   1. dist/public - copied in next to dist/index.js by scripts/copy-frontend.mjs
//      as part of "pnpm --filter @sensor-sim/server build". This is what makes
//      a built server/dist a fully self-contained deployable artifact (e.g.
//      after "pnpm deploy --prod"), with no sibling packages/frontend needed.
//   2. ../../frontend/dist/client - the frontend package's own build output,
//      used when running from source in the monorepo (dev via tsx, or a
//      server build that skipped the copy step). src/index.ts (dev) and
//      dist/index.js (prod) both live directly in packages/server/, so this
//      relative path resolves the same way in both cases as long as
//      packages/server and packages/frontend stay siblings on disk.
const bundledFrontendDist = path.resolve(import.meta.dirname, "public");
const monorepoFrontendDist = path.resolve(import.meta.dirname, "../../frontend/dist/client");
const frontendDist = existsSync(bundledFrontendDist) ? bundledFrontendDist : monorepoFrontendDist;
const frontendIndexHtml = path.join(frontendDist, "index.html");

if (existsSync(frontendDist)) {
  app.use("/*", serveStatic({root: frontendDist}));

  // SPA fallback: any unmatched GET that isn't an API/WS route falls back to
  // index.html so client-side routing (Solid Router) works on full page
  // loads/refreshes of deep links.
  app.get("*", async (c) => {
    const html = await readFile(frontendIndexHtml, "utf-8");
    return c.html(html);
  });
} else {
  console.warn(
    `Frontend build not found at ${frontendDist} - skipping static file serving. Run "pnpm --filter @sensor-sim/frontend build" first.`
  );
}

const wsServer = new WebSocketServer({
  noServer: true,
});

serve(
  {
    fetch: app.fetch,
    websocket: {server: wsServer},
    port: port,
  },
  (info) => {
    console.log(`Server running on port ${info.port}`)
    //if (process.env.NODE_ENV === 'development')
    //  console.log(`Frontend on: http://localhost:${info.port}`)
  }
);

export type AppType = typeof apiRoutes

export * from "./types";

