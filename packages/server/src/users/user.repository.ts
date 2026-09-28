import {db} from "../db";
import {NewUserRow, UpdateUserRow, UserRow, users} from "../db/schema";
import {eq} from "drizzle-orm";

export async function getUsers(): Promise<UserRow[]> {
  return await db
    .select()
    .from(users)
    .orderBy(users.id);
}

export async function getUserById(id: number): Promise<UserRow | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user;
}

export async function getUserByName(username: string): Promise<UserRow | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return user;
}

export async function insertUser(user: NewUserRow) {
  return await db.insert(users).values(user).returning();
}

export async function updateUser(id: number, user: UpdateUserRow) {
  const [updated] = await db.update(users)
    .set(user)
    .where(eq(users.id, id))
    .returning();
  return updated;
}

export async function deleteUserById(id: number) {
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
  return deleted;
}
