import {boolean, pgTable, serial, text} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull().default(""),
  admin: boolean("admin").notNull().default(false),
});


