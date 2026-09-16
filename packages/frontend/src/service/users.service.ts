import {honoClient} from "../honoClient";
import {action, query} from "@solidjs/router";

export const fetchUsers = query(async () => {
  const response = await honoClient.api.users.$get();
  if (!response.ok) throw new Error(`Could not load users`);
  return response.json();
}, "users");

export const fetchUser = query(async (id: string) => {
  const response = await honoClient.api.users[":id"].$get({param: {id}});
  if (!response.ok) throw new Error(`Could not load user`);
  return response.json();
}, "user");


export const addUser = action(async (form: FormData) => {
  const response = await honoClient.api.users.$post({
    json: {
      username: form.get("username") as string,
      password: form.get("password") as string,
      admin: form.get("admin") === "on",
    }
  });
  if (!response.ok) throw new Error(`Could not add user`);
  return response.json();


})


export const deleteUser = action(async (id: string) => {
  const response = await honoClient.api.users[":id"].$delete({param: {id}});
  if (!response.ok) throw new Error(`Could not delete user`);
  return response.json();
});

export const updateUser = action(async (id: number, form: FormData) => {
  const response = await honoClient.api.users[":id"].$put({
    param: {id: String(id)},
    json: {
      username: form.get("username") as string || undefined,
      password: form.get("password") as string || undefined,
      admin: form.get("admin") === "on",
    }
  });
  if (!response.ok) throw new Error(`Could not update user`);
  return response.json();
})


export const fetchMe = query(async () => {
  const response = await honoClient.api.me.$get();
  if (!response.ok) throw new Error(`Could not load user`);
  return response.json();
}, "user");
