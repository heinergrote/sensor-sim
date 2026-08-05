import {createContext, useContext} from "solid-js";
import {createTRPCClient, createWSClient, httpLink, splitLink, wsLink} from "@trpc/client";
import type {AppRouter} from "@sensor-sim/server";

export type TrpcClient = ReturnType<typeof createTRPCClient<AppRouter>>;

export const TrpcContext = createContext<TrpcClient | undefined>(undefined);

const HTTP_URL = process.env.TRCP_HTTP_URL || "http://localhost:4000";
const WS_URL = process.env.TRCP_WS_URL || "ws://localhost:4000";

export function useTrpc(): TrpcClient {
  const ctx = useContext(TrpcContext);
  if (!ctx) throw new Error("useTrpc must be used inside TrpcProvider");
  return ctx;
}

export function createTrpcWithWs() {
  const wsClient = createWSClient({url: WS_URL});
  const client = createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => op.type === "subscription",
        true: wsLink<AppRouter>({client: wsClient}),
        false: httpLink({url: HTTP_URL}),
      }),
    ],
  });
  return {client, dispose: () => wsClient.close()};
}

export function createTrpcHttpOnly() {
  return createTRPCClient<AppRouter>({
    links: [httpLink({url: HTTP_URL})],
  });
}


