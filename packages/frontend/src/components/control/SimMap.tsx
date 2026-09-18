import {createEffect, createMemo, onSettled} from "solid-js";
import {createSimulationMap, SimulationMap} from "./simulationMap";
import {useAuth} from "../../auth";
import {fetchSimulations} from "../../service/simulations.service";

export default function SimMap() {

  const {token} = useAuth()
  const simulations = createMemo(() => fetchSimulations());

  let mapEl!: HTMLDivElement
  let map: SimulationMap | undefined;

  createEffect(
    () => simulations().map((sim) => sim.config.id),
    (simIds) => {
      map?.updateSims(simIds)
    }
  )

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