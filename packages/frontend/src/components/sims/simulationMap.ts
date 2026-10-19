import {GeolocateControl, Map as MapLibre, Marker, NavigationControl, ScaleControl, setWorkerUrl} from "maplibre-gl";
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import {useAction} from "@solidjs/router";
import {addSimulationListener} from "../../service/simulation.service";
import {updateSimConfig} from "../../service/configs.service";
import {GeoPosition, SimConfig} from "@sensor-sim/shared";
import {getAzimuth, getDistance} from "@sensor-sim/shared/geoUtils";

setWorkerUrl(workerUrl);

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
  attachSimConfig: (simConfig: SimConfig | null) => void,
  dispose: () => void
}

/// -------------------------------------------------------------------

export function createSimulationMap(
  element: HTMLDivElement,
  jwtToken: string | null
) {

  const updateSimConfigAction = useAction(updateSimConfig);

  let simConfig: SimConfig | null = null;
  let detachSimConfig: (() => void) | null = null

  let currentOnMap = false;
  let draggingCurrent = false;

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
      } : undefined,
  });

  map.setMissingStyleImageResolver((id) => {
    // Create a 1x1 transparent RGBA pixel for missing icons, to silence the warnings
    map.addImage(id, {width: 1, height: 1, data: new Uint8Array([0, 0, 0, 0])}, {sdf: true});
  });

  map.addControl(new NavigationControl(), 'top-right');
  map.addControl(new ScaleControl(), 'bottom-left');
  map.addControl(new GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true
    },
    trackUserLocation: true,
  }), 'bottom-right');


  const currentMarker = new Marker({
    draggable: true,
    element: createCurrentMarkerElement(),
    anchor: 'center',
  })

  currentMarker.on('dragend', async () => {

    if (!simConfig) return

    const {lng: currentLongitude, lat: currentLatitude} = currentMarker.getLngLat()
    const targetPosition: GeoPosition = {longitude: simConfig.targetLongitude, latitude: simConfig.targetLatitude}
    const currentPosition: GeoPosition = {longitude: currentLongitude, latitude: currentLatitude}

    // calculate new initial distance and azimuth
    const initialDistance = getDistance(targetPosition, currentPosition)
    const initialAzimuth = getAzimuth(targetPosition, currentPosition)

    await updateSimConfigAction(simConfig.id, {
      initialDistance, initialAzimuth,
    })

    draggingCurrent = false;
  })

  currentMarker.on('dragstart', () => {
    draggingCurrent = true;
  });

  const targetMarker = new Marker({
    draggable: true,
    element: createTargetMarkerElement(),
    anchor: 'center',
  })

  targetMarker.on('dragend', async () => {
    if (!simConfig) return;
    const {lng: targetLongitude, lat: targetLatitude} = targetMarker.getLngLat()
    const currentLngLat = currentMarker.getLngLat()
    const targetPosition: GeoPosition = {longitude: targetLongitude, latitude: targetLatitude}
    const currentPosition: GeoPosition = {longitude: currentLngLat.lng, latitude: currentLngLat.lat}

    // calculate new initial distance and azimuth
    const initialDistance = getDistance(targetPosition, currentPosition)
    const initialAzimuth = getAzimuth(targetPosition, currentPosition)

    await updateSimConfigAction(simConfig.id, {
      targetLatitude, targetLongitude, initialDistance, initialAzimuth
    })
  });


  function attachSimConfig(newSimConfig: SimConfig | null) {

    detachSimConfig?.()

    if (!newSimConfig) return

    targetMarker.setLngLat([newSimConfig.targetLongitude, newSimConfig.targetLatitude]);
    targetMarker.addTo(map)

    const removeSimulationListener = addSimulationListener(newSimConfig.id,
      (simState) => {

        if (!currentOnMap) {
          currentMarker.setLngLat([simState.position.longitude, simState.position.latitude])
          currentMarker.addTo(map)
          currentOnMap = true
          currentMarker.getElement().style.zIndex = "9999";
        }
        if (!draggingCurrent)
          currentMarker.setLngLat([simState.position.longitude, simState.position.latitude])
      }
    )

    simConfig = newSimConfig

    detachSimConfig = () => {
      removeSimulationListener()
      if (currentOnMap) currentMarker.remove();
      targetMarker.remove();
      currentOnMap = false

    }

  }

  return {
    map,
    attachSimConfig,
    dispose: () => {
      detachSimConfig?.()
      map.remove()
    }
  }
}