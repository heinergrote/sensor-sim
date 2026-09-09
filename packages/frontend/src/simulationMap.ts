import {GeolocateControl, Map as MapLibre, Marker, NavigationControl, ScaleControl} from "maplibre-gl";
import {TRPCClient} from "@trpc/client";
import type {AppRouter} from "@sensor-sim/server";

//import {FeatureCollection} from "geojson";


function createTargetMarkerElement(): HTMLElement {
  const svgMarker = `<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://w3.org">
     <circle cx="24" cy="24" r="22" fill="blue" fill-opacity="0.2" stroke="blue" stroke-width="2"/>
     <circle cx="24" cy="24" r="2" fill="blue"/>
  </svg>`;
  const el = document.createElement('div');
  el.innerHTML = svgMarker;
  el.className = 'target-marker';
  el.style.cursor = 'pointer';
  return el;
}

function createCurrentMarkerElement(): HTMLElement {
  const svgMarker = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://w3.org">
     <circle cx="12" cy="12" r="11" fill="red" />
  </svg>`;
  const el = document.createElement('div');
  el.innerHTML = svgMarker;
  el.className = 'target-marker';
  el.style.cursor = 'pointer';
  return el;
}


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
      element: createTargetMarkerElement(),
      anchor: 'center',
    })

    const currentMarker = new Marker({
      draggable: true,
      element: createCurrentMarkerElement(),
      anchor: 'center',
    })


    const trackedSim = {
      unsubscribe: () => {
      },
      targetMarker: null as Marker | null,
      currentMarker: null as Marker | null,
      draggingTarget: false,
      draggingCurrent: false,

    }

    targetMarker.on('dragend', () => {
      trackedSim.draggingTarget = false;
      const lngLat = targetMarker.getLngLat()
      client.updateSimTarget.mutate({
        id: id,
        target: {latitude: lngLat.lat, longitude: lngLat.lng}
      });
    });
    targetMarker.on('dragstart', () => {
      trackedSim.draggingTarget = true;
    });


    currentMarker.on('dragend', () => {
      trackedSim.draggingCurrent = false;
      const lngLat = currentMarker.getLngLat()
      client.updateSimCurrent.mutate({
        id: id,
        current: {latitude: lngLat.lat, longitude: lngLat.lng}
      });
    });
    currentMarker.on('dragstart', () => {
      trackedSim.draggingCurrent = true;
    });


    // subscribe to sim changes
    const sub = client.onSimChange.subscribe({id}, {

      onData: (data) => {

        if (!trackedSim.targetMarker) {
          // add on first data received
          trackedSim.targetMarker = targetMarker
          targetMarker.setLngLat([data.config.target.longitude, data.config.target.latitude])
          trackedSim.targetMarker.addTo(map)
        }

        if (!trackedSim.draggingTarget)
          targetMarker.setLngLat(
            [data.config.target.longitude, data.config.target.latitude]
          );


        if (trackedSim.currentMarker && !data.state) {
          // remove, when there is no state
          trackedSim.currentMarker.remove()
          trackedSim.currentMarker = null
        }


        if (data.state && !trackedSim.draggingCurrent) {
          currentMarker.setLngLat([data.state.current.longitude, data.state.current.latitude])
        }

        if (!trackedSim.currentMarker && data.state) {
          // add on first data received
          trackedSim.currentMarker = currentMarker
          trackedSim.currentMarker.addTo(map)
          currentMarker.getElement().style.zIndex = "9999";
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
      onData: (sims) => {
        const simIds = sims.map(sim => sim.config.id);
        // subscribe new, unsubscribe deleted sims
        simIds.forEach(simId => {
          if (!trackedSims.has(simId)) addSim(simId);
        });
        trackedSims.forEach((_, id) => {
          if (!simIds.includes(id)) removeSim(id);
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