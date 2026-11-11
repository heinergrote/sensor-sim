import {createEffect, createSignal, onSettled} from "solid-js";
import {jwtToken} from "../../auth";
import {createSimulationMap, SimulationMap} from "./simulationMap";
import {SimConfig} from "@sensor-sim/shared";

export default function SimMap(props: { simConfig: SimConfig | undefined }) {

  const [mapReady, setMapReady] = createSignal(false);

  // oxlint-disable-next-line no-unassigned-vars
  let mapEl!: HTMLDivElement
  let simulationMap: SimulationMap | undefined

  createEffect(() => {
      const config = props.simConfig
      return {
        mapReady: mapReady(),
        // Plain copy built from ordinary property reads (tracks every field the map uses). Not `deep()`: with
        // solid-js 2.0.0-rc.21, deep() over a createOptimisticStore row spins in snapshotWalk on the second
        // optimistic `update` (e.g. moving the speed slider twice) and freezes the tab.
        // Freezing version: config: props.simConfig ? deep(props.simConfig) : null
        // see https://github.com/solidjs/solid/issues/4771
        config: config ? {...config, spec: config.spec && JSON.parse(JSON.stringify(config.spec))} : null

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
