import {Hono} from 'hono'
import {authMiddleware} from '../middleware/auth'

const MAPTILER_BASE = "https://api.maptiler.com";

const app = new Hono()

  .use('*', authMiddleware)

  .get('/:path{.+$}', async (c) => {

    const key = process.env.MAPTILER_KEY
    if (!key) {
      return c.text("Map service not configured", 500)
    }

    // Captures the wildcard segment exactly like SolidStart's params.path
    const path = c.req.param('path')

    // Build the upstream URL using Hono's query object
    const upstream = new URL(`${MAPTILER_BASE}/${path}`)

    // Forward all query parameters except an existing client-side 'key'
    const queries = c.req.query()
    for (const [name, value] of Object.entries(queries)) {
      if (name !== 'key') {
        upstream.searchParams.set(name, value)
      }
    }
    upstream.searchParams.set("key", key)

    // Fetch from MapTiler
    const upstreamResponse = await fetch(upstream.toString(), {
      headers: {
        Accept: c.req.header('Accept') ?? "*/*",
      },
    })

    if (!upstreamResponse.ok) {
      return c.text(upstreamResponse.statusText, upstreamResponse.status as any)
    }

    const contentType = upstreamResponse.headers.get("content-type") ?? ""
    const cacheControl = upstreamResponse.headers.get("cache-control") ?? "public, max-age=3600"

    // Set downstream headers ahead of response compilation
    c.header("Content-Type", contentType)
    c.header("Cache-Control", cacheControl)

    // Process JSON responses (style.json, tiles.json, etc.)
    if (contentType.includes("application/json")) {
      let body = await upstreamResponse.text()

      // MapLibre requires sprite/glyph URLs to be absolute (it calls `new URL()` on
      // them), so we can't rewrite to root-relative paths. Instead, rebuild the origin
      // from forwarding headers when present, so a TLS-terminating reverse proxy in
      // front of this (http) server still produces https:// URLs for the browser.
      const originUrl = new URL(c.req.url)
      const forwardedProto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim()
      const forwardedHost = c.req.header('x-forwarded-host')?.split(',')[0]?.trim()
      if (forwardedProto) originUrl.protocol = forwardedProto
      if (forwardedHost) originUrl.host = forwardedHost
      const origin = originUrl.origin
      body = body.replace(/https:\/\/api\.maptiler\.com\//g, `${origin}/api/maptiler/`)

      // Strip embedded key params
      body = body.replace(/\?key=[A-Za-z0-9_-]+&/g, "?")
      body = body.replace(/[?&]key=[A-Za-z0-9_-]+/g, "")

      return c.body(body)
    }

    // Handle binary streams (vector tiles, glyphs, sprites) straight through
    if (!upstreamResponse.body) {
      return c.body(null, 204) // Return a 204 No Content if there's no body
    }

    return c.body(upstreamResponse.body)

  })


export default app