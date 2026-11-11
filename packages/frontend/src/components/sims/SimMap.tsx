import {createEffect, createSignal, deep, onSettled} from "solid-js";
import {jwtToken} from "../../auth";
import {createSimulationMap, SimulationMap} from "./simulationMap";
import {SimConfig} from "@sensor-sim/shared";

export default function SimMap(props: { simConfig: SimConfig | undefined }) {

  const [mapReady, setMapReady] = createSignal(false);

  // oxlint-disable-next-line no-unassigned-vars
  let mapEl!: HTMLDivElement
  let simulationMap: SimulationMap | undefined

  createEffect(() => {
      return {
        mapReady: mapReady(),
        config: props.simConfig ? deep(props.simConfig) : null
      }
    },

    ({mapReady, config}) => {
      if (mapReady) {
        simulationMap?.attachSimConfig(config)
      }
    },
    {name: "simMap.attach"}
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
