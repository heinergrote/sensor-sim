import {createEffect, createSignal, onSettled} from "solid-js";
import {jwtToken} from "../../auth";
import {createSimulationMap, SimulationMap} from "./simulationMap";
import {SimConfig} from "@sensor-sim/shared";
import type {MapLibreMap} from "maplibre-gl";

/**
 * The map plus the selected sim's live position. Spec editing lives in the `SpecEditor` components (rendered in
 * the selected `SimCard`), which reach the map through `MapContext` — set here via `onMap`.
 */
export default function SimMap(props: {
  simConfig: SimConfig | undefined,
  onMap?: (map: MapLibreMap | undefined) => void,
}) {

  let mapEl!: HTMLDivElement

  const [simulationMap, setSimulationMap] = createSignal<SimulationMap>();

  // only the id matters for the live position: spec edits must not resubscribe the sim's socket
  createEffect(
    () => ({
      simulationMap: simulationMap(),
      id: props.simConfig?.id ?? null
    }),

    ({simulationMap, id}) => {
      simulationMap?.attachSim(id)
    },

    {name: "simMap.attach"}
  )

  onSettled(
    () => {

      createSimulationMap(mapEl, jwtToken()).then(
        simulationMap => {
          setSimulationMap(simulationMap)
          props.onMap?.(simulationMap.map)
        });

      return () => {
        props.onMap?.(undefined)
        simulationMap()?.dispose()
      }
      
    }
  )

  return <div class="w-full h-full rounded-lg shadow-sm" ref={mapEl}/>;
}
