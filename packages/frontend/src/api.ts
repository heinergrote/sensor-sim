// The server is always reachable at a single, fixed origin: in development
// the Hono server runs standalone on :4000 (separate from the Vite dev
// server on :3000), and in production the server serves the built frontend
// itself, so client and server share the same origin.
import {useAuth} from "./auth";
import ky from "ky";

const {token} = useAuth()

export const serverUrl = import.meta.env.DEV ? "http://localhost:4000" : window.location.origin;

export const api = ky.extend({
  baseUrl: serverUrl,
  prefix: "/api",
  hooks: {
    beforeRequest: [
      ({request}) => {
        request.headers.set('Authorization', `Bearer ${token()}`);
      },
    ]
  }
});
