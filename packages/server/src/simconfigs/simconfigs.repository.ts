import {db} from "../db";
import {NewSimConfigRow, simConfigs} from "../db/schema";
import {eq} from "drizzle-orm";

export type PatchSimConfig = Partial<Omit<NewSimConfigRow, "id" | "ownerId">>;

export async function getSimConfigs() {
  return await db
    .select()
    .from(simConfigs)
    .orderBy(simConfigs.id);
}

export async function getSimConfigsOfUser(ownerId: number) {
  return await db
    .select()
    .from(simConfigs)
    .where(eq(simConfigs.ownerId, ownerId))
    .orderBy(simConfigs.id);
}


export async function getSimConfigById(id: number) {
  const [row] = await db
    .select()
    .from(simConfigs)
    .where(eq(simConfigs.id, id))
    .limit(1);
  return row;
}

export async function insertSimConfig(ownerId: number, simConfig: NewSimConfigRow) {
  const [row] = await db.insert(simConfigs).values({...simConfig, ownerId}).returning();
  return row;
}

export async function updateSimConfig(id: number, simConfig: PatchSimConfig) {
  const [row] = await db.update(simConfigs).set(simConfig).where(eq(simConfigs.id, id)).returning();
  return row;
}

export async function deleteSimConfig(id: number) {
  return await db.delete(simConfigs).where(eq(simConfigs.id, id)).returning();
}