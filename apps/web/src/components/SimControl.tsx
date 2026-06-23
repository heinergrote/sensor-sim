import {createSimulationMap, SimulationMap} from "~/simulationMap";
import {createEffect, onCleanup, onMount} from "solid-js";
import {connectSimStore, disconnectSimStore, sendSimUpdate, simState} from "~/simStore";

export default function SimControl() {
  let mapEl!: HTMLDivElement;
  let map: SimulationMap

  onMount(() => {

    map = createSimulationMap(
      mapEl,
      simState.latitude,
      simState.longitude,
      () => {
        console.log("Map ready")
        connectSimStore();
      },
      (lat, lng) => {
        console.log("Location updated by user: ", lat, lng);
        sendSimUpdate(
          {latitude: lat, longitude: lng}
        )
      }
    );


    onCleanup(() => {
      map?.dispose()
      disconnectSimStore()
    })

  })

  createEffect(
    () => {
      map?.setLocation(simState.latitude, simState.longitude);
    }
  )

  return (
    <>
      <div class="w-full h-128 rounded shadow-lg" ref={mapEl}/>
      <div>Latitude: {simState.latitude}</div>
      <div>Longitude: {simState.longitude}</div>
    </>
  );

}