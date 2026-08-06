import {createEffect, createSignal, onCleanup, Show} from "solid-js";
import {SimState} from "@sensor-sim/shared";
import {trpcService} from "~/trcpService";

export function SimDetails(props: { id: string }) {
  const client = trpcService.client();

  const [simState, setSimState] = createSignal<SimState | undefined>(undefined);

  createEffect(() => {
    const client = trpcService.client();
    if (!client) {
      setSimState(undefined);
      return;
    }

    if (client) {
      const unsubscribe = client.onSimStateChange.subscribe(
        {id: props.id},
        {
          onData: (state) => setSimState(state),
          onError: (err) => console.error(err)
        }
      );

      onCleanup(() => unsubscribe.unsubscribe());
    }

  })


  return (
    <div>
      <Show fallback={<div>Connecting...</div>} when={simState()}>
        {(state) => <div>
          <div>Target: {state().target.latitude.toFixed(5)}, {state().target.longitude.toFixed(5)}</div>
          <div>Current: {state().current.latitude.toFixed(5)}, {state().current.longitude.toFixed(5)}</div>
          <div>Type: {state().type}</div>
          <div>Speed: {state().speed}</div>
          <div>Distance: {state().distance.toFixed(2)}</div>
        </div>}
      </Show>
    </div>
  )
}