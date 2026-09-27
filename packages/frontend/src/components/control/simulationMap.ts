import {GeolocateControl, Map as MapLibre, Marker, NavigationControl, ScaleControl} from "maplibre-gl";
import {useAction} from "@solidjs/router";
import {addSimulationListener} from "../../service/simulation.service";
import {updateCurrent, updateSimConfig} from "../../service/configs.service";
import {SimConfigDto, SimState} from "@sensor-sim/server";

const mapStyle = import.meta.env.VITE_MAP_STYLE || window.location.origin + "/api/maptiler/maps/streets-v2/style.json";

function createTargetMarkerElement(): HTMLElement {
  const svgMarker = `<svg width="48" height="96" viewBox="0 0 48 96" xmlns="http://w3.org">
     <circle cx="24" cy="48" r="2" fill="blue"/>
     <line x1="24" y1="48" x2="24" y2="62" stroke="blue" stroke-width="1"/>
     <circle cx="24" cy="78" r="16" fill="blue" fill-opacity="0.2" stroke="blue" stroke-width="1"/>
  </svg>`;
  const el = document.createElement('div');
  el.innerHTML = svgMarker;
  el.className = 'target-marker';
  el.style.cursor = 'pointer';
  return el;
}

function createCurrentMarkerElement(): HTMLElement {
  const svgMarker = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://w3.org">
     <circle cx="12" cy="12" r="2" fill="red" />
     <circle cx="12" cy="12" r="11" fill="red" fill-opacity="0.2" stroke="red" stroke-width="1"/>
  </svg>`;
  const el = document.createElement('div');
  el.innerHTML = svgMarker;
  el.className = 'target-marker';
  el.style.cursor = 'pointer';
  return el;
}


export type SimulationMap = {
  map: MapLibre,
  updateSimConfigs: (simConfigs: SimConfigDto[]) => void,
  dispose: () => void
}

type TrackedSim = {
  targetMarker: Marker,
  currentMarker: Marker,
  targetOnMap: boolean,
  currentOnMap: boolean,
  draggingTarget: boolean,
  draggingCurrent: boolean,
  updateState: (simState: SimState) => void,
  updateConfig: (simConfig: SimConfigDto) => void,
  dispose: () => void
}

export function createSimulationMap(
  element: HTMLDivElement,
  jwtToken: string | null
) {

  const updateSimConfigAction = useAction(updateSimConfig);
  const updateCurrentAction = useAction(updateCurrent);


  // extract origin from mapStyle url
  const tileServerUrl = new URL(mapStyle).origin;

  const map = new MapLibre({
    container: element,
    style: mapStyle,
    center: [10.523783, 52.264683],
    zoom: 16,
    canvasContextAttributes: {
      preserveDrawingBuffer: true
    },
    transformRequest: jwtToken ?
      (url, _resourceType) => {
        // add bearer token to requests to tileServerUrl
        if (url.startsWith(tileServerUrl)) {
          return {url, headers: {'Authorization': 'Bearer ' + jwtToken}};
        }
        // keep other requests unmodified
        return {url};
      } : undefined
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
    console.log("Map ready", mapStyle)
  });

  const trackedSims = new Map<number, TrackedSim>();

  function createTrackedSim(config: SimConfigDto) {

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

    const removeListener = addSimulationListener(config.id,
      (simState) => trackedSim.updateState(simState)
    )

    const trackedSim = {
      targetMarker,
      currentMarker,
      targetOnMap: false,
      currentOnMap: false,
      draggingTarget: false,
      draggingCurrent: false,

      updateConfig: (simConfig: SimConfigDto) => {
        if (!trackedSim.targetOnMap) {
          trackedSim.targetMarker.setLngLat([simConfig.targetLongitude, simConfig.targetLatitude]);
          trackedSim.targetMarker.addTo(map)
          trackedSim.targetOnMap = true
        }

        if (!trackedSim.draggingTarget)
          trackedSim.targetMarker.setLngLat([simConfig.targetLongitude, simConfig.targetLatitude]);
      },

      updateState: (simState: SimState) => {
        if (!trackedSim.currentOnMap) {
          trackedSim.currentMarker.setLngLat([simState.current.longitude, simState.current.latitude])
          trackedSim.currentMarker.addTo(map)
          trackedSim.currentOnMap = true
          trackedSim.currentMarker.getElement().style.zIndex = "9999";
        }
        if (!trackedSim.draggingCurrent)
          trackedSim.currentMarker.setLngLat([simState.current.longitude, simState.current.latitude])
      },

      dispose: () => {
        if (trackedSim.currentOnMap) trackedSim.currentMarker.remove();
        if (trackedSim.targetOnMap) trackedSim.targetMarker.remove();
        removeListener()
      }

    }

    targetMarker.on('dragend', async () => {
      trackedSim.draggingTarget = false;
      const lngLat = targetMarker.getLngLat()
      await updateSimConfigAction(config.id, {targetLatitude: lngLat.lat, targetLongitude: lngLat.lng})
    });
    targetMarker.on('dragstart', () => {
      trackedSim.draggingTarget = true;
    });

    currentMarker.on('dragend', async () => {
      trackedSim.draggingCurrent = false;
      const lngLat = currentMarker.getLngLat()
      await updateCurrentAction(config.id, lngLat.lat, lngLat.lng);
    });
    currentMarker.on('dragstart', () => {
      trackedSim.draggingCurrent = true;
    });

    trackedSim.updateConfig(config)

    return trackedSim

  }

  function updateSimConfigs(simConfigs: readonly SimConfigDto[]) {
    // add new, remove deleted sims
    simConfigs.forEach(config => {

      if (!trackedSims.has(config.id)) {
        trackedSims.set(config.id, createTrackedSim(config))
      } else {
        trackedSims.get(config.id)!.updateConfig(config)
      }
    });
    trackedSims.forEach((trackedSim, trackedId) => {
      if (!simConfigs.some((config) => config.id === trackedId)) {
        trackedSim.dispose();
        trackedSims.delete(trackedId);
      }
    });
  }

  return {
    map,
    updateSimConfigs,
    dispose: () => {
      updateSimConfigs([])
      map.remove()
    }
  }
}