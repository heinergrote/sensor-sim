import {honoClient} from "../honoClient";

export async function fetchUsers() {
  const response = await honoClient.api.users.$get();
  if (!response.ok) throw new Error(`Could not load users`);
  return response.json();
}
