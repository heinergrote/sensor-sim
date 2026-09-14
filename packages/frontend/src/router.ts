import {createRouter} from '@solidjs/router';
import {lazy} from "solid-js";

export const Router = createRouter({
  routes: [
    {
      path: "/", component: lazy(() => import("./pages/Home"))
    },
    {path: "/control", component: lazy(() => import("./pages/Control"))},
    {path: "/users", component: lazy(() => import("./pages/Users"))},
    {path: "*404", component: lazy(() => import("./pages/NotFound"))},
  ],
});

export const {paths} = Router;