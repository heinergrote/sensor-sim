import {onCleanup, onMount} from "solid-js";
import {createSimulationMap, SimulationMap} from "~/simulationMap";

export default function SimMap() {


  let mapEl!: HTMLDivElement
  let map: SimulationMap | undefined;

  onMount(() => {

    map = createSimulationMap(
      mapEl,
      () => {
        console.log("Map ready")
      },
    );

    onCleanup(() => {
      map?.dispose()
    })

  })

  return (
    <>
      <div class="w-full h-128 rounded shadow-lg" ref={mapEl}/>
    </>
  );

}