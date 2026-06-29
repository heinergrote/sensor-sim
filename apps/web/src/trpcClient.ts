import {createContext, useContext} from "solid-js";
import {createTRPCClient, createWSClient, httpLink, splitLink, wsLink} from "@trpc/client";
import type {AppRouter} from "@sensor-sim/server";

export type TrpcClient = ReturnType<typeof createTRPCClient<AppRouter>>;

export const TrpcContext = createContext<TrpcClient | undefined>(undefined);

export function useTrpc(): TrpcClient {
  const ctx = useContext(TrpcContext);
  if (!ctx) throw new Error("useTrpc must be used inside TrpcProvider");
  return ctx;
}

export function createTrpcWithWs() {
  const wsClient = createWSClient({url: "ws://localhost:3000"});
  const client = createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => op.type === "subscription",
        true: wsLink<AppRouter>({client: wsClient}),
        false: httpLink({url: "http://localhost:3000"}),
      }),
    ],
  });
  return {client, dispose: () => wsClient.close()};
}

export function createTrpcHttpOnly() {
  return createTRPCClient<AppRouter>({
    links: [httpLink({url: "http://localhost:3000"})],
  });
}


