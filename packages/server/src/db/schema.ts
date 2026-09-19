import {boolean, integer, numeric, pgEnum, pgTable, serial, text, varchar} from "drizzle-orm/pg-core";
import {relations} from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull().default(""),
  admin: boolean("admin").notNull().default(false),
});

export const typeEnum = pgEnum('type', ['follow', 'circle']);

export const simConfigs = pgTable("sim_configs", {
  id: varchar("id", {length: 64}).primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  shareToken: text("share_token").notNull().default(""),
  targetLatitude: numeric("target_latitude", {mode: 'number'}).notNull(),
  targetLongitude: numeric("target_longitude", {mode: 'number'}).notNull(),
  initialDistance: numeric("initial_distance", {mode: 'number'}).notNull(),
  initialAzimuth: numeric("initial_azimuth", {mode: 'number'}).notNull(),
  type: typeEnum("type").notNull().default('follow'),
  speed: numeric("speed", {mode: 'number'}).notNull(),
  playing: boolean("playing").notNull().default(false),
});

export const usersRelations = relations(users, ({many}) => ({
  objects: many(simConfigs),
}));

export const objectsRelations = relations(simConfigs, ({one}) => ({
  owner: one(users, {
    fields: [simConfigs.ownerId],
    references: [users.id],
  }),
}));