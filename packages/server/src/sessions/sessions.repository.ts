import {and, eq, isNull, lt, or} from "drizzle-orm";
import {db} from "../db";
import {NewSessionRow, SessionRow, sessions} from "../db/schema";

export async function insertSession(session: NewSessionRow): Promise<SessionRow> {
  const [created] = await db.insert(sessions).values(session).returning();
  return created;
}

/** Matches the current **or** the previous (already rotated) token hash — the caller tells them apart. */
export async function findSessionByTokenHash(hash: string): Promise<SessionRow | undefined> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(or(eq(sessions.refreshTokenHash, hash), eq(sessions.prevTokenHash, hash)))
    .limit(1);
  return session;
}

/**
 * Swaps the token hash, conditional on `oldHash` still being current and the session not revoked, so of two
 * concurrent refreshes with the same token only one wins. Returns `undefined` for the loser.
 */
export async function rotateSession(
  id: number,
  oldHash: string,
  newHash: string,
  update: Pick<NewSessionRow, 'ip' | 'userAgent' | 'expiresAt'>,
): Promise<SessionRow | undefined> {
  const [rotated] = await db.update(sessions)
    .set({
      ...update,
      refreshTokenHash: newHash,
      prevTokenHash: oldHash,
      lastUsedAt: new Date(),
    })
    .where(and(
      eq(sessions.id, id),
      eq(sessions.refreshTokenHash, oldHash),
      isNull(sessions.revokedAt),
    ))
    .returning();
  return rotated;
}

export async function revokeSession(id: number): Promise<void> {
  await db.update(sessions)
    .set({revokedAt: new Date()})
    .where(eq(sessions.id, id));
}

/** Opportunistic cleanup of a user's sessions that can never be refreshed again. */
export async function deleteExpiredSessions(userId: number): Promise<void> {
  await db.delete(sessions)
    .where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
}
