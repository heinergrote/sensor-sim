import {Hono} from "hono";
import {serve} from "@hono/node-server";
import maptiler from "./maptiler";
import sims from "./sims";


export function initRestServer(port: number) {

  const app = new Hono().basePath('/api');

  app.route("/maptiler", maptiler)
  app.route("/sims", sims)

  serve(
    {fetch: app.fetch, port},
    (info) => console.log(`REST Server running on port ${info.port}`)
  );

  return app;
}
