import {createEffect, createSignal, onCleanup, Show} from "solid-js";
import {SimConfig, SimState} from "@sensor-sim/shared";
import {trpcService} from "~/trcpService";

export function SimDetails(props: { id: string }) {

  const [sim, setSim] = createSignal<{ simConfig: SimConfig | null, simState: SimState | null } | undefined>(undefined);

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
          <Show fallback={<div>SimConfig not available</div>} when={sim().simConfig}>
            {(config) => <>
              <div>Target: {config().target.latitude.toFixed(5)}, {config().target.longitude.toFixed(5)}</div>
              <div>Type: {config().type}</div>
              <div>Initial Distance: {config().initialDistance.toFixed(2)}</div>
              <div>InitialAzimuth: {config().initialAzimuth.toFixed(2)}</div>
              <div>Speed: {config().speed}</div>
            </>}
          </Show>
          <hr/>
          <Show when={sim().simState} fallback={<div>SimState not available</div>}>
            {(state) => <>
              <div>Current: {state().current.latitude.toFixed(5)}, {state().current.longitude.toFixed(5)}</div>
              <div>Distance: {state().distance.toFixed(2)}</div>
              <div>Azimuth: {state().azimuth.toFixed(2)}</div>
            </>}
          </Show>
        </div>}
      </Show>
    </div>
  )
}