import {Session} from "@sensor-sim/shared";
import {SessionRow} from "../db/schema";

// row -> DTO; never exposes the token hashes. `currentSessionId` = `sid` of the requesting access token.
export function toDto(row: SessionRow, currentSessionId?: number): Session {
  return {
    id: row.id,
    userAgent: row.userAgent,
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    current: row.id === currentSessionId,
  };
}
