import {api} from "../api";
import {formAction, query} from "@solidjs/router";
import {User} from "@sensor-sim/shared";

export const fetchUsers = query(async () => {
  return api.get<User[]>(`/users`).json();
}, "users");

export const fetchUser = query(async (id: number) => {
  return api.get<User>(`/users/${id}`).json();
}, "user");

export const addUser = formAction(async (form: FormData) => {
  return api.post("/users", {
    json: {
      username: form.get("username") as string,
      password: form.get("password") as string,
      admin: form.get("admin") === "on",
    }
  }).json();
})

export const deleteUser = formAction(async (id: number) => {
  return api.delete(`/users/${id}`).json();
});


export const updateUser = formAction(async (id: number, form: FormData) => {
  return api.put(`/users/${id}`, {
    json: {
      username: form.get("username") as string || undefined,
      password: form.get("password") as string || undefined,
      admin: form.get("admin") === "on",
    }
  }).json();
})

