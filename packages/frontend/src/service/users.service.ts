import {api} from "../api";
import {query, revalidate} from "@solidjs/router";
import {User} from "@sensor-sim/shared";

export const fetchUsers = query(async () => {
  return api.get<User[]>(`/users`).json();
}, "users");

export const fetchUser = query(async (id: number) => {
  return api.get<User>(`/users/${id}`).json();
}, "user");

// plain mutations called from submit/click handlers (no router formAction: the frontend has no server
// functions, so it would only add a URL registry). The router doesn't revalidate after plain fetches —
// each mutation refetches the user queries itself.
function revalidateUsers() {
  revalidate([fetchUsers.key, fetchUser.key])
}

export async function addUser(form: FormData) {
  await api.post("/users", {
    json: {
      username: form.get("username") as string,
      password: form.get("password") as string,
      admin: form.get("admin") === "on",
    }
  })
  revalidateUsers()
}

export async function deleteUser(id: number) {
  await api.delete(`/users/${id}`)
  revalidateUsers()
}

export async function updateUser(id: number, form: FormData) {
  await api.put(`/users/${id}`, {
    json: {
      username: form.get("username") as string || undefined,
      password: form.get("password") as string || undefined,
      admin: form.get("admin") === "on",
    }
  })
  revalidateUsers()
}
