import {createEffect, createSignal, onSettled, Show} from "solid-js";
import {jwtToken} from "../../auth";
import {createSimulationMap, SimulationMap} from "./simulationMap";
import {SimConfig} from "@sensor-sim/shared";
import type {MapLibreMap} from "maplibre-gl";
import {SimCard} from "./SimCard";

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
      let disposed = false

      createSimulationMap(mapEl, jwtToken()).then(
        simulationMap => {
          // unmounted before the map finished loading: nobody will dispose it otherwise
          if (disposed) return simulationMap.dispose()
          setSimulationMap(simulationMap)
          props.onMap?.(simulationMap.map)
        });

      return () => {
        disposed = true
        props.onMap?.(undefined)
        // editors (SpecEditor in the SimCards) are disposed in the same pass, possibly after this cleanup;
        // removing the map only after that lets them detach from a live map (terraDraw.stop() needs its style)
        const current = simulationMap()
        queueMicrotask(() => current?.dispose())
      }
    }
  )

  return (
    <div class="flex flex-col w-full h-full">
      <Show when={props.simConfig}>
        {(config) => <SimCard simConfig={config()}/>}
      </Show>
      <div class="w-full flex-1 rounded-lg shadow-sm" ref={mapEl}/>
    </div>
  );
}
