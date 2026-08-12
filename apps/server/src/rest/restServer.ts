import {Hono} from "hono";
import {serve} from "@hono/node-server";
import {simConfigRegistry} from "../index";

export function initRestServer(port: number) {
  const app = new Hono().basePath('/api');

  app.get('/health', (c) =>
    c.json({status: "ok", uptime: process.uptime()})
  );

  app.get('/sims', (c) => {
    return c.json([...simConfigRegistry.list()]);
  });

  app.get('/sims/:id', (c) => {
    const id = c.req.param('id');
    const sim = simConfigRegistry.get(id);
    if (!sim) {
      return c.json({error: 'Simulation not found'}, 404);
    }
    return c.json(sim);
  });


  serve(
    {
      fetch: app.fetch,
      port
    },
    (info) => console.log(`REST Server running on port ${info.port}`)
  );

  return app;
}
