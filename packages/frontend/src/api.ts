// The server is always reachable at a single, fixed origin: in development
// the Hono server runs standalone on :4000 (separate from the Vite dev
// server on :3000), and in production the server serves the built frontend
// itself, so client and server share the same origin.
import ky from "ky";
import {getValidToken, refreshTokens} from "./auth";


export const serverUrl = import.meta.env.DEV ? "http://localhost:4000" : window.location.origin;

const bearer = (token: string | null) => `Bearer ${token}`

export const api = ky.extend({
  baseUrl: serverUrl,
  prefix: "/api",
  hooks: {
    beforeRequest: [
      // refreshes the access token shortly before it expires
      async ({request}) => {
        request.headers.set('Authorization', bearer(await getValidToken()));
      },
    ],
    afterResponse: [
      // rejected anyway (expired early, clock skew, server restarted with a new secret): refresh once and retry
      async ({request, response, retryCount}) => {
        if (response.status !== 401 || retryCount > 0 || new URL(request.url).pathname.startsWith('/api/login')) {
          return
        }
        const rejected = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? null
        const token = await refreshTokens(rejected)
        if (!token) return

        const headers = new Headers(request.headers);
        headers.set('Authorization', bearer(token));
        return ky.retry({request: new Request(request, {headers}), code: 'TOKEN_REFRESHED', delay: 0});
      },
    ],
  }
});
