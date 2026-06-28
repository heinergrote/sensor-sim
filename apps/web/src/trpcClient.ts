import {Position, SimState} from "@sensor-sim/shared";
import {createTRPCClient, createWSClient, httpLink, splitLink, wsLink} from "@trpc/client";
import type {AppRouter} from "@sensor-sim/server";


const wsClient = createWSClient({
    url: 'ws://localhost:3000'
  },
)

export const trpcClient = createTRPCClient<AppRouter>({
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


export function createSim(id: string) {
  // first query creates the sim
  return trpcClient.simState.query({id});
}


export function setTarget(id: string, pos: Position) {
  trpcClient?.setTarget.mutate({id, ...pos});
}

export function setCurrent(id: string, pos: Position) {
  trpcClient?.setCurrent.mutate({id, ...pos});
}

export function onSimStateChange(simId: string, callback: (state: SimState) => void) {
  return trpcClient.onSimStateChange.subscribe(
    {id: simId},
    {
      onData: (state) => callback(state),
      onError: (err) => console.error('onSimStateChange subscription error', err),
    }
  )
}

export const fetchSims = async () => {
  return await trpcClient.listSims.query();
};


