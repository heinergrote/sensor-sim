import {createSignal, onCleanup, onMount, Show} from "solid-js";
import {SimState} from "@sensor-sim/shared";
import {trpcClient} from "~/trpcClient";

export function SimDetails(props: { id: string }) {

  const [simState, setSimState] = createSignal<SimState | undefined>(undefined);

  onMount(() => {
    const unsubscribe = trpcClient.onSimStateChange.subscribe(
      {id: props.id},
      {
        onData: (state) => {
          setSimState(state);
        },
        onError: (err) => console.error(err)
      }
    );

    onCleanup(() => unsubscribe.unsubscribe());
  });

  return (
    <div>
      <Show fallback={<div>Connecting...</div>} when={simState()}>
        {(state) => <div>
          <div>Lat: {state().current.latitude}</div>
          <div>Lng: {state().current.longitude}</div>
          <div>Distance: {state().distance}</div>
        </div>}
      </Show>
    </div>
  )
}