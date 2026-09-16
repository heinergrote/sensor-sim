import {onSettled} from "solid-js";
import {createSimulationMap, SimulationMap} from "./simulationMap";
import {useAuth} from "../../auth";

export default function SimMap() {

  const {token} = useAuth()

  let mapEl!: HTMLDivElement
  let map: SimulationMap | undefined;

  onSettled(
    () => {
      map = createSimulationMap(mapEl, token());
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