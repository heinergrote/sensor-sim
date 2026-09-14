import {onSettled} from "solid-js";
import {createSimulationMap, SimulationMap} from "../map/simulationMap";

export default function SimMap() {

  let mapEl!: HTMLDivElement
  let map: SimulationMap | undefined;

  onSettled(
    () => {
      map = createSimulationMap(mapEl);
      return () => {
        map?.dispose()
      }
    }
  )

  return (
    <>
      <div class="w-full h-full rounded-lg shadow-sm" ref={mapEl}/>
    </>
  );

}