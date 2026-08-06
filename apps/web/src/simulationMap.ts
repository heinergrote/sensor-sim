import {GeolocateControl, Map as MapLibre, Marker, NavigationControl, ScaleControl} from "maplibre-gl";
import {SimState} from "@sensor-sim/shared";
import {createTrpc} from "~/trpcClient";
//import {FeatureCollection} from "geojson";

export type SimulationMap = {
  map: MapLibre,
  dispose: () => void
}

export function createSimulationMap(
  element: HTMLDivElement,
  onMapReady: () => void
) {

  const client = createTrpc()

  const trackedSims = new Map<string, {
    unsubscribe: () => void,
    targetMarker?: Marker | null,
    currentMarker?: Marker | null,
    draggingTarget: boolean,
    draggingCurrent: boolean,
  }>();


  function addSim(id: string) {

    const sub = client.onSimStateChange.subscribe({id}, {

      onData: (state: SimState) => {

        const {
          target: {latitude: targetLat, longitude: targetLng},
          current: {latitude: currentLat, longitude: currentLng},
        } = state;

        const sim = trackedSims.get(id)
        if (!sim) return

        // first pos data for current or target?

        if (!sim.currentMarker) {
          const marker = new Marker({
            draggable: true,
            color: 'red'
          })
          marker.on('dragend', () => {
            sim.draggingCurrent = false;
            const lngLat = marker.getLngLat()
            client.setCurrent.mutate({id: id, latitude: lngLat.lat, longitude: lngLat.lng});
          });
          marker.on('dragstart', () => {
            sim.draggingCurrent = true;
          });
          marker.setLngLat([currentLng, currentLat])
          marker.addTo(map)
          sim.currentMarker = marker
        }

        if (!sim.targetMarker) {
          const marker = new Marker({
            draggable: true,
            color: 'blue'
          })
          marker.on('dragend', () => {
            sim.draggingTarget = false;
            const lngLat = marker.getLngLat()
            client.setTarget.mutate({id: id, latitude: lngLat.lat, longitude: lngLat.lng});
          });
          marker.on('dragstart', () => {
            sim.draggingTarget = true;
          });
          marker.setLngLat([targetLng, targetLat])
          marker.addTo(map)
          sim.targetMarker = marker
        }

        if (!sim.draggingCurrent)
          sim.currentMarker.setLngLat([currentLng, currentLat]);

        if (!sim.draggingTarget)
          sim.targetMarker.setLngLat([targetLng, targetLat]);

      },

      onError: (err) => console.error("getSimState error", err),

    });

    trackedSims.set(id, {
      unsubscribe: sub.unsubscribe,
      draggingTarget: false,
      draggingCurrent: false,
    })

  }

  function removeSim(id: string) {
    const sim = trackedSims.get(id);
    if (sim) {
      sim.unsubscribe();
      sim.targetMarker?.remove();
      sim.currentMarker?.remove();
      trackedSims.delete(id);
    }
  }

  const listSub = client.onSimListChange.subscribe(
    undefined,
    {
      onData: (ids) => {
        // subscribe new, unsubscribe deleted sims
        ids.forEach(id => {
          if (!trackedSims.has(id)) addSim(id);
        });
        trackedSims.forEach((_, id) => {
          if (!ids.includes(id)) removeSim(id);
        });
      },
      onError: (err) => console.error("getSimList error", err),
    }
  );

  const map = new MapLibre({
    container: element,
    style: `/api/maptiler/maps/streets-v2/style.json`,
    center: [10.523783, 52.264683],
    zoom: 16,
    canvasContextAttributes: {
      preserveDrawingBuffer: true
    }
  });

  map.addControl(new NavigationControl(), 'top-right');

  map.addControl(new ScaleControl(), 'bottom-left');

  map.addControl(new GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true
    },
    trackUserLocation: true,
  }), 'bottom-right');

  map.on('load', () => {
    onMapReady();
  });

  // map.on('mouseenter', 'locations', () => {
  //   map.getCanvas().style.cursor = 'pointer';
  // });
  //
  // map.on('mouseleave', 'locations', () => {
  //   map.getCanvas().style.cursor = '';
  // });

  return {
    map,
    dispose: () => {
      map.remove()

      listSub.unsubscribe();
      trackedSims.forEach((_, id) => {
        removeSim(id);
      });
    }
  }

}