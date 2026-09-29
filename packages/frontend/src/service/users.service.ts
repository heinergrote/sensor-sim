import {api} from "../api";
import {action, query} from "@solidjs/router";
import {UserDto} from "@sensor-sim/shared";

export const fetchUsers = query(async () => {
  return api.get<UserDto[]>(`/users`).json();
}, "users");

export const fetchUser = query(async (id: string) => {
  return api.get<UserDto>(`/users/${id}`).json();
}, "user");

export const addUser = action(async (form: FormData) => {
  return api.post("/users", {
    json: {
      username: form.get("username") as string,
      password: form.get("password") as string,
      admin: form.get("admin") === "on",
    }
  }).json();
})

export const deleteUser = action(async (id: string) => {
  return api.delete(`/users/${id}`).json();
});


export const updateUser = action(async (id: number, form: FormData) => {
  return api.put(`/users/${id}`, {
    json: {
      username: form.get("username") as string || undefined,
      password: form.get("password") as string || undefined,
      admin: form.get("admin") === "on",
    }
  }).json();
})

