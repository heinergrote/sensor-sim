import {createEffect, createSignal, onSettled} from "solid-js";
import {jwtToken} from "../../auth";
import {createSimulationMap, SimulationMap} from "./simulationMap";
import {SimConfig} from "@sensor-sim/shared";

export default function SimMap(props: { simConfig: SimConfig | undefined }) {

  const [mapReady, setMapReady] = createSignal(false);

  // oxlint-disable-next-line no-unassigned-vars
  let mapEl!: HTMLDivElement
  let simulationMap: SimulationMap | undefined

  createEffect(() => ({
      ready: mapReady(),
      // copy, so a field change re-runs the effect even if the config object is updated in place
      config: props.simConfig ? {...props.simConfig} : null
    }),
    (c) => {
      if (c.ready) simulationMap?.attachSimConfig(c.config)
    }
  )

  onSettled(
    () => {
      simulationMap = createSimulationMap(mapEl, jwtToken(), () => {
        setMapReady(true);
      });
      return () => {
        simulationMap?.dispose()
      }
    }
  )

  return (
    <>
      <div class="w-full h-full rounded-lg shadow-sm" ref={mapEl}/>
    </>
  );

}
