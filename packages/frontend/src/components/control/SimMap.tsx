import {createEffect, createMemo, createSignal, onSettled} from "solid-js";
import {createSimulationMap, SimulationMap} from "./simulationMap";
import {jwtToken} from "../../auth";
import {fetchSimConfigs} from "../../service/configs.service";

export default function SimMap() {

  const simConfigs = createMemo(() => fetchSimConfigs());

  const [mapReady, setMapReady] = createSignal(false);

  let mapEl!: HTMLDivElement
  let map: SimulationMap | undefined;

  createEffect(() => ({
      ready: mapReady(),
      configs: simConfigs()
    }),
    (c) => {
      if (c.ready) map?.updateSimConfigs(c.configs)
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