import {JWTPayload} from "../types";
import {getUserById} from "../user.service";
import {createMiddleware} from 'hono/factory'
import {jwt} from 'hono/jwt'
import {createHmac} from "node:crypto";

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is not set')
}

export const authMiddleware = jwt({secret: jwtSecret, alg: "HS256"})

interface VerifyAuthOptions {
  checkDb?: boolean
}

export const verifyAuth = (
  requireAdmin: boolean,
  options: VerifyAuthOptions = {}
) => {
  return createMiddleware(async (c, next) => {

      const payload = c.get('jwtPayload') as JWTPayload
      if (!payload) {
        return c.json({error: 'Unauthorized'}, 401)
      }

      let userIsAdmin = payload.admin || false;

      // Optional db fallback (for critical actions or fast-revocation security)
      if (options.checkDb) {
        const dbUser = await getUserById(payload.sub)

        if (!dbUser) {
          return c.json({error: 'User not found/disabled'}, 403)
        }

        userIsAdmin = dbUser.admin
      }

      const validRole = !requireAdmin || userIsAdmin
      if (!validRole) {
        return c.json({error: 'Forbidden: Insufficient permissions'}, 403)
      }

      await next()
    }
  )
}


export function createShareToken(resourceId: string, ownerId: number) {
  if (!jwtSecret) {
    throw new Error("JWT secret is not set");
  }

  const rawPayload = `${ownerId}:${resourceId}`;

  // short (8 bytes, 64 bits) HMAC-Signature to protect against manipulation
  const signature = createHmac('sha256', jwtSecret)
    .update(rawPayload)
    .digest('hex')
    .slice(0, 12);

  const fullString = `${rawPayload}:${signature}`;

  // url safe Base64 encoding
  return Buffer.from(fullString)
    .toString('base64url')
    .replace(/=/g, ''); // remove padding

}


export function verifyShareToken(token: string) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');

    if (parts.length !== 3) return null;

    const [ownerId, resourceId, providedSig] = parts;
    const rawPayload = `${ownerId}:${resourceId}`;

    const expectedSig = createHmac('sha256', jwtSecret!)
      .update(rawPayload)
      .digest('hex')
      .slice(0, 12);

    if (providedSig !== expectedSig) {
      return null; // token manipulated!
    }

    const ownerIdAsNumber = parseInt(ownerId);
    if (isNaN(ownerIdAsNumber)) {
      return null;
    }

    return {ownerId: ownerIdAsNumber, resourceId};
  } catch {
    return null;
  }

}
