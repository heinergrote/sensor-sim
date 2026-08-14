import {GeolocateControl, Map as MapLibre, Marker, NavigationControl, ScaleControl} from "maplibre-gl";
import {TRPCClient} from "@trpc/client";
import type {AppRouter} from "@sensor-sim/server";
//import {FeatureCollection} from "geojson";

export type SimulationMap = {
  map: MapLibre,
  dispose: () => void
}

export function createSimulationMap(
  element: HTMLDivElement,
  client: TRPCClient<AppRouter>,
  onMapReady: () => void
) {

  const trackedSims = new Map<string, {
    unsubscribe: () => void,
    targetMarker?: Marker | null,
    currentMarker?: Marker | null,
    draggingTarget: boolean,
  }>();

  function addSim(id: string) {

    const targetMarker = new Marker({
      draggable: true,
      color: 'blue'
    })

    const currentMarker = new Marker({
      draggable: true,
      color: 'red'
    })


    const trackedSim = {
      unsubscribe: () => {
      },
      targetMarker: null as Marker | null,
      currentMarker: null as Marker | null,
      draggingTarget: false,
    }

    targetMarker.on('dragend', () => {
      trackedSim.draggingTarget = false;
      const lngLat = targetMarker.getLngLat()
      client.updateSim.mutate({
        id: id,
        target: {latitude: lngLat.lat, longitude: lngLat.lng}
      });
    });
    targetMarker.on('dragstart', () => {
      trackedSim.draggingTarget = true;
    });


    // subscribe to sim changes
    const sub = client.onSimChange.subscribe({id}, {

      onData: (data) => {

        if (!trackedSim.targetMarker) {
          // add on first data received
          trackedSim.targetMarker = targetMarker
          targetMarker.setLngLat([data.config.target.longitude, data.config.target.latitude])
          trackedSim.targetMarker.addTo(map)
          targetMarker.getElement().style.zIndex = "9999";
        }

        if (!trackedSim.draggingTarget)
          targetMarker.setLngLat(
            [data.config.target.longitude, data.config.target.latitude]
          );

        if (data.state) {
          currentMarker.setLngLat([data.state.current.longitude, data.state.current.latitude])
        }

        if (!trackedSim.currentMarker && data.state) {
          // add on first data received
          trackedSim.currentMarker = currentMarker
          trackedSim.currentMarker.addTo(map)
        }

        if (trackedSim.currentMarker && !data.state) {
          // remove, when there is no state
          trackedSim.currentMarker.remove()
          trackedSim.currentMarker = null
        }


      },

      onError: (err) => console.error("onSimChange error", err),

    });

    trackedSim.unsubscribe = sub.unsubscribe;

    trackedSims.set(id, trackedSim)

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
        console.log("onSimListChange", ids);
        // subscribe new, unsubscribe deleted sims
        ids.forEach(id => {
          if (!trackedSims.has(id)) addSim(id);
        });
        trackedSims.forEach((_, id) => {
          console.log("onSimListChange", id);
          if (!ids.includes(id)) removeSim(id);
        });
      },
      onError: (err) => console.error("onSimListChange error", err),
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