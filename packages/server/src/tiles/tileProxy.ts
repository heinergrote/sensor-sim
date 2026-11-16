import {Hono} from 'hono'
import {jwtMiddleware} from '../middleware/jwtAuth'

export type TileProvider = {
  /** upstream origin, e.g. `https://api.maptiler.com` (no trailing slash) */
  upstream: string,
  /** upstream path of the style served as `<mount>/style.json`, e.g. `styles/bright` */
  stylePath: string,
  /** env var holding the provider's API key. When set, the key is required (500 without it), injected as `?key=`
   *  upstream, and stripped from client queries and JSON responses. Omit for keyless providers. */
  keyEnv?: string,
}

/** The provider-neutral style path clients request; mapped to `provider.stylePath` upstream. */
export const STYLE_PATH = 'style.json'

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Authenticated pass-through proxy for a MapLibre tile provider: style.json, TileJSON, vector/raster tiles,
 * sprites and glyphs. JSON bodies get their absolute upstream URLs rewritten to this proxy, so every follow-up
 * request MapLibre makes comes back through here (and carries the JWT via `transformRequest`) and the client never
 * learns which provider is behind it.
 */
export function createTileProxy({upstream, stylePath, keyEnv}: TileProvider, mountPath: string) {
  const upstreamUrlPattern = new RegExp(`${escapeRegExp(upstream)}/`, 'g')

  return new Hono()

    .use('*', jwtMiddleware)

    .get('/:path{.+$}', async (c) => {

      const key = keyEnv ? process.env[keyEnv] : undefined
      if (keyEnv && !key) {
        return c.text("Map service not configured", 500)
      }

      const path = c.req.param('path')
      const upstreamUrl = new URL(`${upstream}/${path === STYLE_PATH ? stylePath : path}`)

      // Forward all query parameters except a client-side 'key'
      for (const [name, value] of Object.entries(c.req.query())) {
        if (name !== 'key') {
          upstreamUrl.searchParams.set(name, value)
        }
      }
      if (key) {
        upstreamUrl.searchParams.set("key", key)
      }

      const upstreamResponse = await fetch(upstreamUrl.toString(), {
        headers: {
          Accept: c.req.header('Accept') ?? "*/*",
        },
      })

      if (!upstreamResponse.ok) {
        return c.text(upstreamResponse.statusText, upstreamResponse.status as any)
      }

      const contentType = upstreamResponse.headers.get("content-type") ?? ""
      const cacheControl = upstreamResponse.headers.get("cache-control") ?? "public, max-age=3600"

      c.header("Content-Type", contentType)
      c.header("Cache-Control", cacheControl)

      // JSON responses (style.json, TileJSON, sprite index): rewrite upstream URLs to this proxy
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
        body = body.replace(upstreamUrlPattern, `${originUrl.origin}${mountPath}/`)

        if (keyEnv) {
          // Strip embedded key params
          body = body.replace(/\?key=[A-Za-z0-9_-]+&/g, "?")
          body = body.replace(/[?&]key=[A-Za-z0-9_-]+/g, "")
        }

        return c.body(body)
      }

      // Binary streams (vector tiles, glyphs, sprites) straight through
      if (!upstreamResponse.body) {
        return c.body(null, 204)
      }

      return c.body(upstreamResponse.body)
    })
}
