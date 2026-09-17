import {migrate} from "drizzle-orm/node-postgres/migrator";
import {eq} from "drizzle-orm";
import {resolve} from "node:path";
import {hashPassword} from "../util/passwords";
import {db} from "./index";
import {users} from "./schema";

async function initAndMigrateDb() {

  console.log("DB Init: Running pending database migrations...");

  // resolve relative to cwd so it works in both dev (project root) and Docker (/app)
  const migrationsFolder = resolve(process.cwd(), "drizzle");
  await migrate(db, {migrationsFolder});

  console.log("DB Init: Migrations done.");

  const adminUsername = process.env.DEFAULT_ADMIN_USERNAME ?? "admin";
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn("DEFAULT_ADMIN_PASSWORD not set; skipping default admin creation.");
    return;
  }

  const existingAdmin = await db.select().from(users).where(eq(users.username, adminUsername)).limit(1).execute();

  if (existingAdmin.length > 0) {
    console.log(`DB Init: User '${adminUsername}' already exists. Skipping creation.`);
  } else {
    const hashedPassword = await hashPassword(adminPassword);
    await db.insert(users)
      .values({username: adminUsername, password: hashedPassword, admin: true})
      .onConflictDoNothing({target: users.username});

    console.log(`DB Init: Default admin added (User: ${adminUsername}).`);
  }

  console.log("DB Init: Database initialisation complete.");
};

export default initAndMigrateDb;
