import {createEffect, createSignal, onSettled, Show} from "solid-js";
import {createSimulationMap, SimulationMap} from "./simulationMap";
import {SimConfig} from "@sensor-sim/shared";
import {SimCard} from "./SimCard";
import {MapContext} from "./editors/mapContext";
import {MapLibreMap} from "maplibre-gl";

/**
 * The selected sim's `SimCard` above the map with its live position. Spec editing lives in the `SpecEditor`
 * components (rendered in that `SimCard`), which reach the map through the `MapContext` provided here.
 */
export default function SimDetails(props: {
  simConfig: SimConfig | undefined
}) {

  let mapEl!: HTMLDivElement

  const [simulationMap, setSimulationMap] = createSignal<SimulationMap>();
  const [map, setMap] = createSignal<MapLibreMap>();

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

      // creating the MapLibre map (WebGL context, canvas, controls) takes >10ms synchronously: run it in the next
      // frame, off the reactive path, so the page paints first and the settle pass stays cheap (HOT_SCOPE_TIME)
      const frame = requestAnimationFrame(() =>
        createSimulationMap(mapEl).then(
          simulationMap => {
            // unmounted before the map finished loading: nobody will dispose it otherwise
            if (disposed) return simulationMap.dispose()
            setSimulationMap(simulationMap)
            setMap(simulationMap.map)
          })
      )

      return () => {
        disposed = true
        cancelAnimationFrame(frame)
        // editors (SpecEditor in the SimCards) are disposed in the same pass, possibly after this cleanup;
        // removing the map only after that lets them detach from a live map (terraDraw.stop() needs its style)
        const current = simulationMap()
        queueMicrotask(() => current?.dispose())
      }
    }
  )

  return (
    <MapContext value={map}>
      <div class="flex flex-col w-full h-full">
        <Show when={props.simConfig}>
          {(config) =>
            <SimCard simConfig={config()}/>
          }
        </Show>
        <div class="w-full flex-1 rounded-lg shadow-sm" ref={mapEl}/>
      </div>
    </MapContext>
  );
}
