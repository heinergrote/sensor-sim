import {createEffect, onCleanup, onMount} from "solid-js";
import {createSimulationMap, SimulationMap} from "~/simulationMap";
import {createStore} from "solid-js/store";
import {SimState} from "@sensor-sim/shared";
import {onSimStateChange, setCurrent, setTarget} from "~/trpcClient";

export default function SimMap(props: { simId: string }) {

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

  let unsub = onSimStateChange(props.simId, (state) => {
    setSimState(state);
  });

  onMount(() => {

    map = createSimulationMap(
      mapEl,
      simState,
      () => {
        console.log("Map ready")
      },
      (latitude, longitude) => {
        setTarget(props.simId, {latitude, longitude});
      },
      (latitude, longitude) => {
        setCurrent(props.simId, {latitude, longitude});
      },
    );

    onCleanup(() => {
      unsub.unsubscribe()
      map?.dispose()
    })

  })

  createEffect(
    () => {
      unsub.unsubscribe();
      unsub = onSimStateChange(props.simId, (state) => {
        setSimState(state);
      });
    }
  )


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