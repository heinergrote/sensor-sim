import {createRouter, intentPreload} from '@solidjs/router';
import {routes} from "./routes";

export const Router = createRouter({
  routes,
  preloadLinks: intentPreload(), // hover/focus a link → chunk + preload start early
});

export const {paths} = Router;