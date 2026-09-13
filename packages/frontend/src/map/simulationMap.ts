import {GeolocateControl, Map as MapLibre, Marker, NavigationControl, ScaleControl} from "maplibre-gl";
import {Simulation} from "@sensor-sim/server";
import {addSimulationsListener, honoClient} from "../simulationsService";

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

type TrackedSim = {
  targetMarker: Marker,
  currentMarker: Marker,
  targetOnMap: boolean,
  currentOnMap: boolean,
  draggingTarget: boolean,
  draggingCurrent: boolean,
  update: (sim: Simulation) => void,
  dispose: () => void
}

export function createSimulationMap(
  element: HTMLDivElement
) {

  const map = new MapLibre({
    container: element,
    style: import.meta.env.VITE_MAP_STYLE,
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
    console.log("Map ready", import.meta.env.VITE_MAP_STYLE)
  });

  const trackedSims = new Map<string, TrackedSim>();

  function createTrackedSim(id: string) {

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
      targetMarker,
      currentMarker,
      targetOnMap: false,
      currentOnMap: false,
      draggingTarget: false,
      draggingCurrent: false,
      update: (sim: Simulation) => {
        if (!trackedSim.targetOnMap) {
          trackedSim.targetMarker.setLngLat([sim.config.target.longitude, sim.config.target.latitude]);
          trackedSim.targetMarker.addTo(map)
          trackedSim.targetOnMap = true
        }

        if (!trackedSim.draggingTarget)
          trackedSim.targetMarker.setLngLat([sim.config.target.longitude, sim.config.target.latitude]);

        if (sim.state) {
          if (!trackedSim.currentOnMap) {
            trackedSim.currentMarker.setLngLat([sim.state.current.longitude, sim.state.current.latitude])
            trackedSim.currentMarker.addTo(map)
            trackedSim.currentOnMap = true
            trackedSim.currentMarker.getElement().style.zIndex = "9999";
          }
          if (!trackedSim.draggingCurrent)
            trackedSim.currentMarker.setLngLat([sim.state.current.longitude, sim.state.current.latitude])
        } else {
          // remove, when there is no state
          trackedSim.currentMarker.remove()
          trackedSim.currentOnMap = false
        }
      },
      dispose: () => {
        if (trackedSim.currentOnMap) trackedSim.currentMarker.remove();
        if (trackedSim.targetOnMap) trackedSim.targetMarker.remove();
      }
    }

    targetMarker.on('dragend', () => {
      trackedSim.draggingTarget = false;
      const lngLat = targetMarker.getLngLat()
      honoClient?.api.sims.updateTarget.$post({
        json: {
          id: id,
          target: {latitude: lngLat.lat, longitude: lngLat.lng}
        }
      });
    });
    targetMarker.on('dragstart', () => {
      trackedSim.draggingTarget = true;
    });


    currentMarker.on('dragend', () => {
      trackedSim.draggingCurrent = false;
      const lngLat = currentMarker.getLngLat()
      honoClient?.api.sims.updateCurrent.$post({
        json: {
          id: id,
          current: {latitude: lngLat.lat, longitude: lngLat.lng}
        }
      });
    });
    currentMarker.on('dragstart', () => {
      trackedSim.draggingCurrent = true;
    });

    return trackedSim

  }

  
  function updateSims(sims: readonly Simulation[]) {
    // add new, remove deleted sims
    sims.forEach(sim => {
      const trackedSim = trackedSims.getOrInsertComputed(
        sim.config.id,
        (id) => createTrackedSim(id)
      )
      trackedSim.update(sim)
      trackedSims.forEach((trackedSim, trackedId) => {
        if (!sims.some(sim => sim.config.id === trackedId)) {
          trackedSim.dispose();
          trackedSims.delete(trackedId);
        }
      });
    });
  }

  const removeSimulationsListener = addSimulationsListener((sims) => {
    updateSims(sims)
  })

  return {
    map,
    dispose: () => {
      removeSimulationsListener()
      updateSims([])
      map.remove()
    }
  }
}