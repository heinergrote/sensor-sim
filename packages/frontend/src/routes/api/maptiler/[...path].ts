import {APIEvent} from "@solidjs/start/server";
const MAPTILER_BASE = "https://api.maptiler.com";

export async function GET(event: APIEvent) {
  "use server";

  const key = process.env.MAPTILER_KEY;
  if (!key) {
    return new Response("Map service not configured", {status: 500});
  }

  // event.params.path is the catch-all segment, e.g. "maps/streets-v2/style.json"
  const path = event.params.path;

  // Build the upstream URL, forwarding all query params except key
  const incoming = new URL(event.request.url);
  const upstream = new URL(`${MAPTILER_BASE}/${path}`);
  incoming.searchParams.forEach((value, name) => {
    if (name !== "key") upstream.searchParams.set(name, value);
  });
  upstream.searchParams.set("key", key);

  const upstreamResponse = await fetch(upstream.toString(), {
    headers: {
      Accept: event.request.headers.get("Accept") ?? "*/*",
    },
  });

  if (!upstreamResponse.ok) {
    return new Response(upstreamResponse.statusText, {status: upstreamResponse.status});
  }

  const contentType = upstreamResponse.headers.get("content-type") ?? "";
  const cacheControl = upstreamResponse.headers.get("cache-control") ?? "public, max-age=3600";

  // For JSON responses (style.json, tiles.json, …) rewrite all MapTiler URLs
  // to go through our proxy, and strip the key parameter so it never reaches the client.
  if (contentType.includes("application/json")) {
    let body = await upstreamResponse.text();

    // Use absolute URLs so MapLibre's Web Worker (which runs on a blob: URL) can
    // resolve tile/font/sprite URLs correctly against the real page origin.
    const origin = new URL(event.request.url).origin;
    body = body.replace(/https:\/\/api\.maptiler\.com\//g, `${origin}/api/maptiler/`);

    // Strip any embedded key param so the API key never appears in the JSON
    body = body.replace(/\?key=[A-Za-z0-9_-]+&/g, "?"); // key is first of multiple params
    body = body.replace(/[?&]key=[A-Za-z0-9_-]+/g, ""); // key is the only / last param

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  }

  // Binary responses (vector tiles, fonts/glyphs, sprites) — stream straight through
  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    },
  });
}

