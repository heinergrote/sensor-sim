import {boolean, integer, jsonb, pgSequence, pgTable, serial, text} from "drizzle-orm/pg-core";
import {relations, sql} from "drizzle-orm";
import {Spec} from "@sensor-sim/shared";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull().default(""),
  admin: boolean("admin").notNull().default(false),
});

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
  spec: jsonb("spec").$type<Spec>(),
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

