import {createEffect, onCleanup} from "solid-js";
import {createSimulationMap, SimulationMap} from "~/simulationMap";
import {trpcService} from "~/trcpService";

export default function SimMap() {

  let mapEl!: HTMLDivElement
  let map: SimulationMap | undefined;

  createEffect(() => {
      const client = trpcService.client()
      if (client) {
        map = createSimulationMap(
          mapEl,
          client,
          () => {
            console.log("Map ready")
          },
        );
      } else {
        map?.dispose()
      }

    },
    onCleanup(() => {
      map?.dispose()
    })
  )

  return (
    <>
      <div class="w-full h-full rounded shadow-lg" ref={mapEl}/>
    </>
  );

}