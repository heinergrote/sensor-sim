import {createEffect, createMemo, createSignal, onSettled} from "solid-js";
import {createSimulationMap, SimulationMap} from "./simulationMap";
import {jwtToken} from "../../auth";
import {fetchSimulations} from "../../service/simulations.service";

export default function SimMap() {

  const simulations = createMemo(() => fetchSimulations());

  const [mapReady, setMapReady] = createSignal(false);

  let mapEl!: HTMLDivElement
  let map: SimulationMap | undefined;

  createEffect(() => ({
      ready: mapReady(),
      simIds: simulations().map((sim) => sim.config.id)
    }),
    (c) => {
      if (c.ready) map?.updateSims(c.simIds)
    }
  )

  onSettled(
    () => {
      map = createSimulationMap(mapEl, jwtToken());
      setMapReady(true);
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