import {createEffect, createSignal, onCleanup, Show} from "solid-js";
import {SimConfig, SimState} from "@sensor-sim/shared";
import {trpcService} from "~/trcpService";

export function SimDetails(props: { id: string }) {

  const [sim, setSim] = createSignal<{ simConfig: SimConfig, simState: SimState } | undefined>(undefined);

  createEffect(() => {
    const client = trpcService.client();
    if (!client) {
      setSim(undefined);
      return;
    }

    if (client) {
      const unsubscribe = client.onSimStateChange.subscribe(
        {id: props.id},
        {
          onData: (data) => setSim(data),
          onError: (err) => console.error(err)
        }
      );

      onCleanup(() => unsubscribe.unsubscribe());
    }

  })


  return (
    <div>
      <Show fallback={<div>Connecting...</div>} when={sim()}>
        {(sim) => <div>
          <div>Target: {sim().simConfig.target.latitude.toFixed(5)}, {sim().simConfig.target.longitude.toFixed(5)}</div>
          <div>Type: {sim().simConfig.type}</div>
          <div>Speed: {sim().simConfig.speed}</div>
          <div>Current: {sim().simState.current.latitude.toFixed(5)}, {sim().simState.current.longitude.toFixed(5)}</div>
          <div>Distance: {sim().simState.distance.toFixed(2)}</div>
        </div>}
      </Show>
    </div>
  )
}