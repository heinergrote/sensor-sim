import {api} from "../api";
import {query, revalidate} from "@solidjs/router";
import {Session} from "@sensor-sim/shared";

/** the caller's own active sessions */
export const fetchOwnSessions = query(async () => {
  return api.get<Session[]>(`/sessions`).json();
}, "ownSessions");

/** a user's active sessions (admin only) */
export const fetchUserSessions = query(async (userId: number) => {
  return api.get<Session[]>(`/users/${userId}/sessions`).json();
}, "userSessions");

// plain mutations (see users.service.ts): revalidate both lists themselves — an admin's own sessions show up in both
function revalidateSessions() {
  revalidate([fetchOwnSessions.key, fetchUserSessions.key])
}

export async function revokeOwnSession(id: number) {
  try {
    await api.delete(`/sessions/${id}`)
  } finally {
    revalidateSessions() // also on 404 (already gone): show the current list
  }
}

export async function revokeUserSession(userId: number, id: number) {
  try {
    await api.delete(`/users/${userId}/sessions/${id}`)
  } finally {
    revalidateSessions()
  }
}
