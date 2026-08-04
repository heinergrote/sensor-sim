import {defineConfig, Plugin} from "vite";
import {solidStart} from "@solidjs/start/config";
import {nitro} from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";


/**
 * WORKAROUND for nitro dev server bug — remove once a nitro release includes the fix.
 *
 * Nitro's dev pre-middleware (`nitroDevMiddlewarePre` in `nitro/dist/_build/vite.dev.mjs`)
 * uses `sec-fetch-dest` to detect static asset requests. When a browser loads
 * `<img src="/api/...">` it sends `sec-fetch-dest: image`, which nitro classifies
 * as an asset, marks as `_nitroHandled=true`, and lets Vite's static-file serving
 * handle — which returns 404 because there is no physical file.
 *
 * Tracked in: https://github.com/nitrojs/nitro/issues/4284
 *
 * Fix strategy: register an `/api` prefix middleware **before** nitro's pre-middleware.
 * Nitro skips its asset heuristic when it sees a registered handler whose route is a
 * prefix of the request URL. Our middleware then dispatches the request to
 * nitro's FetchableDevEnvironment so it reaches SolidStart's SSR handler.
 *
 * To remove: delete this function and its entry from the plugins array below.
 */
function fixApiDevRouting(): Plugin {
  return {
    name: "fix-api-dev-routing",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api", async (req: any, res: any, next: any) => {
        const fetchableEnv = Object.values(server.environments).find(
          (env: any) => typeof env.dispatchFetch === "function"
        ) as any;

        if (!fetchableEnv) return next();

        const host = req.headers.host ?? "localhost";
        const originalUrl: string = req.originalUrl ?? `/api${req.url}`;
        const url = `http://${host}${originalUrl}`;

        const headers = new Headers();
        for (const [key, val] of Object.entries(req.headers as Record<string, string | string[]>)) {
          if (val !== undefined) {
            headers.set(key, Array.isArray(val) ? val.join(", ") : val);
          }
        }

        try {
          const webReq = new Request(url, {method: req.method ?? "GET", headers});
          const webRes: Response = await fetchableEnv.dispatchFetch(webReq);
          res.statusCode = webRes.status;
          for (const [k, v] of webRes.headers.entries()) res.setHeader(k, v);
          res.end(Buffer.from(await webRes.arrayBuffer()));
        } catch (err) {
          next(err);
        }
      });
    },
  };
}


export default defineConfig({
  plugins: [
    solidStart({
      devOverlay: false
    }),
    tailwindcss(),
    fixApiDevRouting(), // must be before nitro() so it's registered before nitro's pre-middleware
    nitro(),
  ],

  ssr: {
    noExternal: ['maplibre-gl']
  }
});
