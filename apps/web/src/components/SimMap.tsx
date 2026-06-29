import {createEffect, onCleanup, onMount} from "solid-js";
import {createSimulationMap, SimulationMap} from "~/simulationMap";
import {createStore} from "solid-js/store";
import {SimState} from "@sensor-sim/shared";
import {useTrpc} from "~/trpcClient";

export default function SimMap(props: { simId: string }) {
  const client = useTrpc();

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

  let mapEl!: HTMLDivElement
  let map: SimulationMap

  onMount(() => {

    map = createSimulationMap(
      mapEl,
      simState,
      () => {
        console.log("Map ready")
      },
      (latitude, longitude) => {
        client.setTarget.mutate({id: props.simId, latitude, longitude});
      },
      (latitude, longitude) => {
        client.setCurrent.mutate({id: props.simId, latitude, longitude});
      },
    );

    createEffect(() => {
      // tracks props.simId reactively; old sub is cleaned up before new one starts
      const sub = client.onSimStateChange.subscribe(
        {id: props.simId},
        {
          onData: (state) => setSimState(state),
          onError: (err) => console.error("onSimStateChange error", err),
        }
      );
      onCleanup(() => sub.unsubscribe());
    });

    onCleanup(() => {
      map?.dispose()
    })

  })

  createEffect(
    () => {
      map?.update({...simState});
    }
  )

  return (
    <>
      <div class="w-full h-128 rounded shadow-lg" ref={mapEl}/>
      <pre>{props.simId}</pre>
    </>
  );

}