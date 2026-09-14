import 'dotenv/config';
import {drizzle} from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

// construct database url
if (!databaseUrl) throw new Error("Missing environment variable DATABASE_URL!");
if (!URL.canParse(databaseUrl)) {
  throw new Error("Invalid databaseUrl: " + databaseUrl);
}

export const db = drizzle(databaseUrl, {schema});
