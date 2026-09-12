#!/usr/bin/env node
// Copies the built frontend static bundle into the server's own dist folder
// (dist/public) so that "packages/server/dist" is a fully self-contained
// deployable artifact - no sibling "packages/frontend" checkout required at
// runtime. Runs as the last step of the server's "build" script, after tsup
// and after the frontend itself has been built.
import {cp, rm} from "node:fs/promises";
import {existsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, "..");
const frontendDist = path.resolve(serverDir, "../frontend/dist/client");
const target = path.resolve(serverDir, "dist/public");

if (!existsSync(frontendDist)) {
  console.error(
    `copy-frontend: frontend build not found at ${frontendDist}. ` +
    `Run "pnpm --filter @sensor-sim/frontend build" first.`
  );
  process.exit(1);
}

await rm(target, {recursive: true, force: true});
await cp(frontendDist, target, {recursive: true});

console.log(`copy-frontend: copied ${frontendDist} -> ${target}`);
