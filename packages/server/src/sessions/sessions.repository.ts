import {and, desc, eq, gt, isNull, lt, or} from "drizzle-orm";
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

/** Sessions that can still be refreshed (not revoked, not expired), most recently used first. */
export async function getActiveSessions(userId: number): Promise<SessionRow[]> {
  return await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.lastUsedAt));
}

/**
 * Revokes a session only if it belongs to `userId` and is still active. `false` = no such session for that user
 * (unknown, someone else's, or already revoked) — callers answer 404 without telling which.
 */
export async function revokeUserSession(userId: number, id: number): Promise<boolean> {
  const revoked = await db.update(sessions)
    .set({revokedAt: new Date()})
    .where(and(eq(sessions.id, id), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .returning({id: sessions.id});
  return revoked.length > 0;
}

/** Opportunistic cleanup of a user's sessions that can never be refreshed again. */
export async function deleteExpiredSessions(userId: number): Promise<void> {
  await db.delete(sessions)
    .where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
}
