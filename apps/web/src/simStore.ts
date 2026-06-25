import {createStore, reconcile} from "solid-js/store";
import {Position, SimState} from "@sensor-sim/shared";
import {createTRPCClient, createWSClient, httpLink, splitLink, wsLink} from "@trpc/client";
import type {AppRouter} from "@sensor-sim/server";

const [simState, setSimState] = createStore<SimState>({
  target: {
    latitude: 0,
    longitude: 0,
  },
  current: {
    latitude: 0,
    longitude: 0,
  },
  distance: 0,
});

let trpcClient: ReturnType<typeof createTRPCClient<AppRouter>> | undefined;
let wsClient: ReturnType<typeof createWSClient> | undefined;

export function connectSimStore() {

  disconnectSimStore(); // disconnect previous connection, if any

  wsClient = createWSClient({
    url: 'ws://localhost:3000',
  });

  trpcClient = createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => op.type === "subscription",
        true: wsLink<AppRouter>({client: wsClient}),
        false: httpLink({
          url: `http://localhost:3000`,
        }),
      })
    ],
  });

  trpcClient.simState.query().then(
    (state) => {
      setSimState(reconcile(state));
    },
    (err) => {
      console.error("Failed to fetch initial state", err);
    }
  );

  trpcClient.onSimStateChange.subscribe(
    undefined,
    {
      onStarted() {
        console.log("onSimStateChange subscription started");
      },
      onData(state) {
        setSimState(reconcile(state));
      },
      onError(err) {
        console.error('onSimStateChange subscription error', err);
      },
    }
  )

}

export function disconnectSimStore() {
  if (wsClient) {
    console.log("Disconnecting WS");
    wsClient.close().then(() => {
      wsClient = undefined;
    });
  }
}

export function setTarget(pos: Position) {
  setSimState("target", reconcile(pos));  // optimistic local update
  trpcClient?.setTarget.mutate(pos);
}

export function setCurrent(pos: Position) {
  setSimState("current", reconcile(pos));  // optimistic local update
  trpcClient?.setCurrent.mutate(pos);
}


export {simState};
