import {lazy} from "solid-js";
import {defineRoute, defineRoutes} from "@solidjs/router";
import {simsRoute} from "./pages/sims/sims.route";
import {userRoute, usersRoute} from "./pages/users/users.route";

// Each page becomes its own chunk
const Home = lazy(() => import("./pages/Home"));
const Sims = lazy(() => import("./pages/sims/Sims"));
const Users = lazy(() => import("./pages/users/Users"));
const User = lazy(() => import("./pages/users/User"));
const NotFound = lazy(() => import("./pages/NotFound"));

export const routes = defineRoutes([
  {path: "/", component: Home},
  // defineRoute types the component's params from the path (a plain object only accepts optional params)
  defineRoute({...simsRoute, component: Sims}),
  defineRoute({...usersRoute, component: Users}),
  defineRoute({...userRoute, component: User}),

  // catch-all; params["404"] holds the unmatched rest of the path
  {path: "*404", component: NotFound},
]);
