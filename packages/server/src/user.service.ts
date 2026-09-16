import {db} from "./db";
import {users} from "./db/schema";
import {eq, getTableColumns} from "drizzle-orm";
import {UserInput, UserUpdate} from "./zodSchema";
import {User} from "./types";


const sensitiveFields = ['password'] as const;

const allColumns = getTableColumns(users);
// the cast with Omit keeps the type intact for the returned values
const allowedColumns = Object.fromEntries(
  Object.entries(allColumns).filter(
    ([key]) => !(sensitiveFields as readonly string[]).includes(key)
  )
) as Omit<typeof allColumns, typeof sensitiveFields[number]>;


export async function getUsers() {
  return await db
    .select(allowedColumns)
    .from(users)
    .orderBy(users.id);
}

export async function getUserById(id: number) {
  const [user] = await db
    .select(allowedColumns)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user;
}

export async function getUserWithSecretsByName(username: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1) as [User | undefined];

  return user;
}

export async function insertUser(user: UserInput) {
  return await db.insert(users).values(user).returning(allowedColumns);
}

export async function updateUser(id: number, values: UserUpdate) {
  return await db.update(users)
    .set(values)
    .where(eq(users.id, id))
    .returning(allowedColumns);
}

export async function deleteUserById(id: number) {
  return await db.delete(users).where(eq(users.id, id)).returning(allowedColumns);
}
