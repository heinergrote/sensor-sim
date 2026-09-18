import "dotenv/config";
import {existsSync} from "node:fs";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {createSimulationService} from "./simulations.service";
import {Hono} from "hono";
import {cors} from "hono/cors";
import loginApp from "./routes/login";
import maptilerApp from "./routes/maptiler";
import simsApp from "./routes/sims";
import usersApp from "./routes/users";
import meApp from "./routes/me";
import simsWebsocketApp from "./routes/simsWebsocket";
import {WebSocketServer} from "ws";
import {serve} from "@hono/node-server";
import {serveStatic} from "@hono/node-server/serve-static";
import {db} from "./db";

// Migrations are NOT run here — they are applied by the separate "migrate"
// entrypoint (src/migrate.ts) before this process starts. See the compose stack's
// one-shot migrate service, or run "pnpm db:migrate" locally.
console.log("Starting server -", process.env.NODE_ENV);

const port = Number(process.env.PORT) || 4000;

export const simulationService = await createSimulationService()

const app = new Hono()

  .use('*', cors({origin: '*',}))

  .route("/api/login", loginApp)
  .route("/ws/sims", simsWebsocketApp)
  .route("/api/maptiler", maptilerApp)
  .route('/api/sims', simsApp)
  .route('/api/me', meApp)
  .route('/api/users', usersApp)


// Serve the built frontend from the same origin/process. Two possible locations, checked in order:
//   1. dist/public - copied in next to dist/index.js by scripts/copy-frontend.mjs
//      as part of "pnpm --filter @sensor-sim/server build", to serve the static frontend in production
//   2. ../../frontend/dist/client - the frontend package's own build output, used when running from source
//      in the monorepo (dev via tsx, or a server build that skipped the copy step). src/index.ts (dev) and
//      dist/index.js (prod) both live directly in packages/server/, so this relative path works
//      if packages/server and packages/frontend stay siblings on disk.
const bundledFrontendDist = path.resolve(import.meta.dirname, "public");
const monorepoFrontendDist = path.resolve(import.meta.dirname, "../../frontend/dist/client");
const frontendDist = existsSync(bundledFrontendDist) ? bundledFrontendDist : monorepoFrontendDist;
const frontendIndexHtml = path.join(frontendDist, "index.html");

if (existsSync(frontendDist)) {
  app.use("/*", serveStatic({root: frontendDist}));

  // SPA fallback: any unmatched GET that isn't an API/WS route falls back to index.html so client-side routing
  // works on full page loads/refreshes of deep links.
  app.get("*", async (c) => {
    const html = await readFile(frontendIndexHtml, "utf-8");
    return c.html(html);
  });
} else {
  console.warn(
    `Frontend build not found at ${frontendDist} - skipping static file serving.`
  );
}

const wsServer = new WebSocketServer({
  noServer: true,
});

const server = serve(
  {
    fetch: app.fetch,
    websocket: {server: wsServer},
    port: port,
  },
  (info) => {
    console.log(`Server running on port ${info.port}`)
  }
);


// Without this, nothing stops the sim tick intervals or the WS/DB connections, so on SIGTERM/SIGINT
// (sent by tsx watch on every restart, or by ctrl-c) the process can't exit on its own and the port
// stays bound until something force-kills it.
let shuttingDown = false;

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down...`);

  simulationService.shutdown();

  for (const client of wsServer.clients) {
    client.terminate();
  }
  wsServer.close();

  server.close(async () => {
    await db.$client.end();
    process.exit(0);
  });

  // in case close() never settles (e.g. a stuck connection), don't block the port forever
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export type AppType = typeof app

export * from "./types";

