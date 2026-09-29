import {boolean, integer, numeric, pgEnum, pgSequence, pgTable, serial, text} from "drizzle-orm/pg-core";
import {relations, sql} from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull().default(""),
  admin: boolean("admin").notNull().default(false),
});

export const typeEnum = pgEnum('type', ['follow', 'circle']);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type UpdateUserRow = Partial<Omit<NewUserRow, 'id'>>;

// ---------------------------------------------------------

export const simConfigLabelSeq = pgSequence("sim_config_label_seq", {
  startWith: 1,
  increment: 1,
});

export const simConfigs = pgTable("sim_configs", {
  id: serial("id").primaryKey(),
  label: text("label")
    .notNull()
    .unique()
    .default(sql.raw(`'sim-' || nextval('sim_config_label_seq')`)),
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

export type SimConfigRow = typeof simConfigs.$inferSelect;
export type NewSimConfigRow = typeof simConfigs.$inferInsert;

// ---------------------------------------------------------

export const usersRelations = relations(users, ({many}) => ({
  objects: many(simConfigs),
}));

export const simConfigsRelations = relations(simConfigs, ({one}) => ({
  owner: one(users, {
    fields: [simConfigs.ownerId],
    references: [users.id],
  }),
}));

