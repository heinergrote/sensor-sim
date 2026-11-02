import {GeolocateControl, MapLibreMap, Marker, NavigationControl, ScaleControl, setWorkerUrl} from "maplibre-gl";
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import {addSimulationListener} from "../../service/simulation.service";
import {SimConfig, Spec, SpecOrbit, SpecPath} from "@sensor-sim/shared";
import {createSimulationOrbit} from "./simulationOrbit";
import {createSimulationPath} from "./simulationPath";
import {updateSimConfig} from "../../service/configs.service";
import {useAction} from "@solidjs/router";
import {createSimulationFixed} from "./simulationFixed";

setWorkerUrl(workerUrl);

const mapStyle = import.meta.env.VITE_MAP_STYLE || window.location.origin + "/api/maptiler/maps/streets-v2/style.json";

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
  map: MapLibreMap,
  attachSimConfig: (simConfig: SimConfig | null) => void,
  dispose: () => void
}

export type ConfigSpecRenderer<T extends Spec> = {
  updateSpec: (spec: T) => void,
  dispose: () => void
}

/// -------------------------------------------------------------------

export function createSimulationMap(
  element: HTMLDivElement,
  jwtToken: string | null
) {

  const updateSimConfigAction = useAction(updateSimConfig);

  const onSpecUpdate = async (id: number, spec: Spec) => {
    await updateSimConfigAction(id, {
      spec
    })
  }

  let configSpecRenderer: ConfigSpecRenderer<any> | null = null;
  let simConfig: SimConfig | null = null;

  let currentOnMap = false;
  let removeSimulationListener: (() => void) | null = null;

  // extract origin from mapStyle url
  const tileServerUrl = new URL(mapStyle).origin;

  const map = new MapLibreMap({
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
    element: createCurrentMarkerElement(),
    anchor: 'center',
  })

  function attachSimConfig(newSimConfig: SimConfig | null) {

    removeSimulationListener?.()
    removeSimulationListener = null
    if (currentOnMap) currentMarker.remove();
    currentOnMap = false

    configSpecRenderer?.dispose()
    configSpecRenderer = null

    simConfig = null

    if (!newSimConfig) return

    simConfig = newSimConfig

    removeSimulationListener = addSimulationListener(simConfig.id,
      (simState) => {

        if (!currentOnMap) {
          currentMarker.setLngLat([simState.position.longitude, simState.position.latitude])
          currentMarker.addTo(map)
          currentOnMap = true
          currentMarker.getElement().style.zIndex = "9999";
        }
        currentMarker.setLngLat([simState.position.longitude, simState.position.latitude])
      }
    )

    if (simConfig.spec) {
      const id = simConfig.id
      switch (simConfig.spec.type) {
        case "fixed":
          configSpecRenderer = createSimulationFixed(
            simConfig.spec, map,
            (spec) => onSpecUpdate(id, spec)
          )
          break;
        case "orbit":
          configSpecRenderer = createSimulationOrbit(
            simConfig.spec as SpecOrbit, map,
            (spec) => onSpecUpdate(id, spec)
          )
          break;
        case "path":
          configSpecRenderer = createSimulationPath(
            simConfig.spec as SpecPath, map,
            (spec) => onSpecUpdate(id, spec)
          )
          break;
      }
    }

  }

  return {
    map,
    attachSimConfig,
    dispose: () => {
      removeSimulationListener?.()
      configSpecRenderer?.dispose()
      if (currentOnMap) currentMarker.remove();
      map.remove()
    }
  }
}