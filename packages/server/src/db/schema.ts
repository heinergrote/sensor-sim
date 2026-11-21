import {boolean, index, integer, jsonb, pgSequence, pgTable, serial, text, timestamp} from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(
    () => new Date()
  ),
});

export type SimConfigRow = typeof simConfigs.$inferSelect;
export type NewSimConfigRow = typeof simConfigs.$inferInsert;

// ---------------------------------------------------------

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, {onDelete: "cascade"}),
  // sha256 (hex) of the opaque refresh token; the token itself is never stored
  refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  // hash before the last rotation — presenting it again means the token leaked → revoke
  prevTokenHash: text("prev_token_hash"),
  userAgent: text("user_agent").notNull().default(""),
  ip: text("ip").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at").notNull().defaultNow(),
  // sliding: moved to now + REFRESH_TTL on every refresh
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
}, (t) => [
  index("sessions_prev_token_hash_idx").on(t.prevTokenHash),
  index("sessions_user_id_idx").on(t.userId),
]);

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;

// ---------------------------------------------------------

export const usersRelations = relations(users, ({many}) => ({
  objects: many(simConfigs),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const simConfigsRelations = relations(simConfigs, ({one}) => ({
  owner: one(users, {
    fields: [simConfigs.ownerId],
    references: [users.id],
  }),
}));

