// Standalone migration entrypoint: applies pending Drizzle migrations and seeds the
// default admin, then exits. Deliberately separate from the server process — the app
// no longer migrates on boot, so a failed migration is a failed deploy that never
// starts the app, rather than a server that crash-loops.
//
// Built by tsup alongside the server; run it with "node dist/migrate.js" (the
// "migrate" package script). In Docker Compose it runs as a one-shot service that
// the server waits on via "condition: service_completed_successfully".
//
// Locally you can keep using "pnpm db:migrate" (drizzle-kit) instead — this exists
// because drizzle-kit is a devDependency and is absent from the production image.
import "dotenv/config";
import {db} from "./db";
import dbInit from "./db/dbInit";

try {
  await dbInit();
} catch (error) {
  console.error("Migration failed:", error);
  await db.$client.end().catch(() => {});
  process.exit(1);
}

await db.$client.end();
process.exit(0);
