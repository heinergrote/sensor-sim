import {defineRoute, int} from "@solidjs/router";
import {fetchSimConfigs} from "../../service/configs.service";

// never import the page component here: routes.ts imports this file statically
export const simsRoute = defineRoute({
  path: "/sims/:id?",
  matchFilters: {id: int},
  preload: () => void fetchSimConfigs(),
});
