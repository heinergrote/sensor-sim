import {createEffect, createRoot, createSignal, onCleanup} from "solid-js";
import {createTRPCClient, createWSClient, httpBatchLink, splitLink, TRPCClient, wsLink} from "@trpc/client";
import type {AppRouter} from "@sensor-sim/server";
import {isServer} from "solid-js/web";

export const STORAGE_KEY = "trpc_server_url";

//const httpUrl = "http://localhost:4000"
//const httpUrl = "https://sensor-sim-server.h9e.de"

const [url, setUrlState] = createSignal<string>("");
const [client, setClient] = createSignal<TRPCClient<AppRouter> | null>(null);

let wsClient: ReturnType<typeof createWSClient> | null = null;

// Update state and sync with LocalStorage
function setUrl(newUrl: string) {
  if (isServer) return;
  const trimmed = newUrl.trim();
  localStorage.setItem(STORAGE_KEY, trimmed);
  setUrlState(trimmed);
}

function initUrl() {
  if (isServer) return;
  const storedUrl = localStorage.getItem(STORAGE_KEY);
  if (storedUrl) {
    setUrlState(storedUrl);
  }
}


createRoot(() => {
  createEffect(() => {
    const currentUrl = url();

    // Teardown active WebSocket connection if URL changes
    if (wsClient) {
      wsClient.close();
      wsClient = null;
    }

    if (!currentUrl) {
      setClient(null);
      return;
    }

    // Convert http(s) URL to ws(s)
    const wsUrl = currentUrl.replace(/^http/, "ws");

    // Initialize WebSocket client for subscriptions
    wsClient = createWSClient({
      url: wsUrl,
    });

    // Instantiate a new tRPC client whenever the URL updates
    const trpcClient = createTRPCClient<AppRouter>({
      links: [
        splitLink({
          condition: (op) => op.type === "subscription",
          true: wsLink({client: wsClient}),
          false: httpBatchLink({url: currentUrl}),
        }),
      ],
    });

    setClient(() => trpcClient);

    // Clean up WS connection on root disposal
    onCleanup(() => {
      if (wsClient) {
        wsClient.close();
        wsClient = null;
      }
    });

  });
});

// 3. Export Service API
export const trpcService = {
  url,
  setUrl,
  initUrl,
  client,
};