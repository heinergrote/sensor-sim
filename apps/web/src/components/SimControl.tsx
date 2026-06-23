import {createSimulationMap, SimulationMap} from "~/simulationMap";
import {createEffect, onCleanup, onMount} from "solid-js";
import {connectSimStore, disconnectSimStore, setTarget, simState} from "~/simStore";

export default function SimControl() {
  let mapEl!: HTMLDivElement;
  let map: SimulationMap

  onMount(() => {

    map = createSimulationMap(
      mapEl,
      simState,
      () => {
        console.log("Map ready")
        connectSimStore();
      },
      (lat, lng) => {
        setTarget({latitude: lat, longitude: lng})
      }
    );


    onCleanup(() => {
      map?.dispose()
      disconnectSimStore()
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
      <pre>{JSON.stringify(simState, null, 2)}</pre>
    </>
  );

}