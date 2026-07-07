import {createSignal, onCleanup, onMount, Show} from "solid-js";
import {SimState} from "@sensor-sim/shared";
import {useTrpc} from "~/trpcClient";

export function SimDetails(props: { id: string }) {
  const client = useTrpc();

  const [simState, setSimState] = createSignal<SimState | undefined>(undefined);

  onMount(() => {
    const unsubscribe = client.onSimStateChange.subscribe(
      {id: props.id},
      {
        onData: (state) => setSimState(state),
        onError: (err) => console.error(err)
      }
    );

    onCleanup(() => unsubscribe.unsubscribe());
  });

  return (
    <div>
      <Show fallback={<div>Connecting...</div>} when={simState()}>
        {(state) => <div>
          <div>Current: {state().current.latitude}, Lng: {state().current.longitude}</div>
          <div>Type: {state().type}</div>
          <div>Speed: {state().speed}</div>
          <div>Distance: {state().distance}</div>
        </div>}
      </Show>
    </div>
  )
}