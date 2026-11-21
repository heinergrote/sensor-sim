import {createHash, randomBytes} from "node:crypto";
import {Context} from "hono";
import {sign} from "hono/jwt";
import {getConnInfo} from "@hono/node-server/conninfo";
import {LoginResponse} from "@sensor-sim/shared";
import {UserRow} from "../db/schema";
import {JWTPayload} from "../types";
import {jwtSecret} from "../util/appSecret";
import {getUserById} from "../users/user.repository";
import {findSessionByTokenHash, insertSession, revokeSession, rotateSession} from "./sessions.repository";

export const ACCESS_TTL_S = 15 * 60;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const USER_AGENT_MAX_LENGTH = 512;

export type ClientInfo = { ip: string, userAgent: string };

/**
 * User agent + client IP of a request. Forwarding headers are only trusted with `TRUST_PROXY=true` (the server
 * runs behind a reverse proxy) — otherwise any client could put an arbitrary IP into its session.
 */
export function clientInfo(c: Context): ClientInfo {
  const userAgent = (c.req.header('User-Agent') ?? '').slice(0, USER_AGENT_MAX_LENGTH);

  let ip: string | undefined;
  if (process.env.TRUST_PROXY === 'true') {
    ip = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || c.req.header('X-Real-IP')?.trim();
  }
  if (!ip) {
    try {
      ip = getConnInfo(c).remote.address;
    } catch {
      // not running on @hono/node-server (e.g. app.request() in tests)
    }
  }

  return {ip: ip ?? '', userAgent};
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const newRefreshToken = () => randomBytes(32).toString('base64url');

const refreshExpiry = () => new Date(Date.now() + REFRESH_TTL_MS);

async function issueTokens(user: UserRow, sessionId: number, refreshToken: string): Promise<LoginResponse> {
  const exp = Math.floor(Date.now() / 1000) + ACCESS_TTL_S;
  const payload: JWTPayload = {
    sub: user.id,
    username: user.username,
    admin: user.admin,
    sid: sessionId,
    exp,
  };
  const accessToken = await sign(payload, jwtSecret(), "HS256");
  return {accessToken, refreshToken, accessExpiresAt: exp * 1000};
}

/** New session for a freshly authenticated user. */
export async function createSession(user: UserRow, client: ClientInfo): Promise<LoginResponse> {
  const refreshToken = newRefreshToken();
  const session = await insertSession({
    userId: user.id,
    refreshTokenHash: hashToken(refreshToken),
    ip: client.ip,
    userAgent: client.userAgent,
    expiresAt: refreshExpiry(),
  });
  return issueTokens(user, session.id, refreshToken);
}

/**
 * Rotates the refresh token and slides the session expiry. `undefined` = 401. A token that was already rotated
 * away is treated as stolen: the whole session is revoked.
 */
export async function refreshSession(refreshToken: string, client: ClientInfo): Promise<LoginResponse | undefined> {
  const hash = hashToken(refreshToken);
  const session = await findSessionByTokenHash(hash);
  if (!session || session.revokedAt) return undefined;

  if (session.refreshTokenHash !== hash) {
    console.warn(`Session ${session.id} (user ${session.userId}): rotated refresh token reused, revoking`);
    await revokeSession(session.id);
    return undefined;
  }

  if (session.expiresAt.getTime() <= Date.now()) return undefined;

  // re-read the user, so username/admin changes reach the next access token
  const user = await getUserById(session.userId);
  if (!user) return undefined;

  const nextToken = newRefreshToken();
  const rotated = await rotateSession(session.id, hash, hashToken(nextToken), {
    ip: client.ip,
    userAgent: client.userAgent,
    expiresAt: refreshExpiry(),
  });
  // lost the race against a concurrent refresh/revoke with the same token
  if (!rotated) return undefined;

  return issueTokens(user, session.id, nextToken);
}

/** Revokes the session of this refresh token, if any. Silent either way. */
export async function endSession(refreshToken: string): Promise<void> {
  const hash = hashToken(refreshToken);
  const session = await findSessionByTokenHash(hash);
  if (session && !session.revokedAt) {
    await revokeSession(session.id);
  }
}
