import {createEffect, createMemo, createSignal, onSettled} from "solid-js";
import {jwtToken} from "../../auth";
import {fetchSimConfig} from "../../service/configs.service";
import {createSimulationMap, SimulationMap} from "./simulationMap";

export default function SimMap(props: { simId: number | null }) {

  const simConfig = createMemo(() => {
    if (props.simId === null) return null
    return fetchSimConfig(props.simId)
  });

  const [mapReady, setMapReady] = createSignal(false);

  // oxlint-disable-next-line no-unassigned-vars
  let mapEl!: HTMLDivElement
  let map: SimulationMap | undefined

  createEffect(() => ({
      ready: mapReady(),
      config: simConfig()
    }),
    (c) => {
      if (c.ready) map?.attachSimConfig(c.config)
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