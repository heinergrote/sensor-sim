import {createContext, useContext} from "solid-js";
import {createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink} from "@trpc/client";
import type {AppRouter} from "@sensor-sim/server";
import {isServer} from "solid-js/web";

export type TrpcClient = ReturnType<typeof createTRPCClient<AppRouter>>;

export const TrpcContext = createContext<TrpcClient | undefined>(undefined);

const httpUrl = "http://localhost:4000"

//const httpUrl = "https://sensor-sim-server.h9e.de/"

export function useTrpc(): TrpcClient {
  const ctx = useContext(TrpcContext);
  if (!ctx) throw new Error("useTrpc must be used inside TrpcProvider");
  return ctx;
}

export function createTrpc() {

  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => !isServer && op.type === "subscription",
        true: httpSubscriptionLink({url: httpUrl}),
        false: httpBatchLink({url: httpUrl}),
      }),
    ],
  });
}



