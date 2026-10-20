import {defineRoute, int} from "@solidjs/router";
import {fetchUser, fetchUsers} from "../../service/users.service";

// never import the page components here: routes.ts imports this file statically
export const usersRoute = defineRoute({
  path: "/users",
  preload: () => void fetchUsers(),
});

export const userRoute = defineRoute({
  path: "/users/:id",
  matchFilters: {id: int},
  preload: ({params}) => void fetchUser(Number(params.id)),
});
