// The server is always reachable at a single, fixed origin: in development
// the Hono server runs standalone on :4000 (separate from the Vite dev
// server on :3000), and in production the server serves the built frontend
// itself, so client and server share the same origin.
import {hc} from "hono/client";
import {AppType} from "@sensor-sim/server";
import {useAuth} from "./auth";

const {token} = useAuth()

export const serverUrl = import.meta.env.DEV ? "http://localhost:4000" : window.location.origin;

export const honoClient = hc<AppType>(serverUrl, {
  headers: () => ({
    Authorization: token() ? `Bearer ${token()}` : "",
  }),
});

