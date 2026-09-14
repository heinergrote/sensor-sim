import {db} from "./db";
import {users} from "./db/schema";
import {eq} from "drizzle-orm";
import {UserInput, UserUpdate} from "./zodSchema";

export async function getUsers() {
  return await db.query.users.findMany({
    orderBy: users.id,
    columns: {password: false}
  });
}

export async function getUserById(id: number) {
  return await db.query.users.findFirst({
    columns: {password: false},
    where: (user, {eq}) => eq(user.id, id),
  });
}

export async function getUserByName(username: string) {
  return await db.query.users.findFirst({where: eq(users.username, username)});
}

export async function insertUser(user: UserInput) {
  return await db.insert(users).values(user).returning();
}

export async function updateUser(id: number, values: UserUpdate) {
  return await db.update(users)
    .set(values)
    .where(eq(users.id, id))
    .returning();
}

export async function deleteUserById(id: number) {
  return await db.delete(users).where(eq(users.id, id)).returning();
}
