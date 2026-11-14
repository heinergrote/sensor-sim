import {GeolocateControl, MapLibreMap, Marker, NavigationControl, ScaleControl, setWorkerUrl} from "maplibre-gl";
import {addSimulationListener} from "../../service/simulation.service";
import {SimConfig, Spec} from "@sensor-sim/shared";
import {createEditControllerOrbit} from "./editControllerOrbit";
import {createEditControllerPath} from "./editControllerPath";
import {createEditControllerFixed} from "./editControllerFixed";
import {currentMarkerElement} from "./markerElement";

// In dev, Vite rewrites the worker's dynamic `import()`s to go through `/@vite/client`, which then runs the HMR
// client inside the worker and throws `document is not defined` on every CSS hot update. Load the untransformed
// source as a blob instead; the build keeps the hashed asset URL. Both branches are dead-code-eliminated per mode.
setWorkerUrl(import.meta.env.DEV
  ? URL.createObjectURL(new Blob(
    [(await import('maplibre-gl/dist/maplibre-gl-worker.mjs?raw')).default],
    {type: 'text/javascript'},
  ))
  : (await import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url')).default);

const mapStyle = import.meta.env.VITE_MAP_STYLE || window.location.origin + "/api/maptiler/maps/streets-v2/style.json";


export type SimulationMap = {
  map: MapLibreMap,
  attachSimConfig: (simConfig: SimConfig | null) => void,
  editController: SpecEditController<any> | null,
  dispose: () => void
}

export type SpecEditController<T extends Spec> = {
  update: (spec: T) => void,
  save: () => void,
  dispose: () => void
}

function createEditController(config: SimConfig, map: MapLibreMap): SpecEditController<any> {

  if (!config.spec) {
    throw new Error(`No spec provided`);
  }

  switch (config.spec.type) {
    case "fixed":
      return createEditControllerFixed(config, map)
    case "orbit":
      return createEditControllerOrbit(config, map)
    case "path":
      return createEditControllerPath(config, map)
    default:
      throw new Error(`Unknown spec type`)
  }

}

/// -------------------------------------------------------------------

export async function createSimulationMap(
  element: HTMLDivElement,
  jwtToken: string | null,
): Promise<SimulationMap> {


  let editController: SpecEditController<any> | null = null;
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
    element: currentMarkerElement(),
    anchor: 'center',
  })

  function attachSimConfig(newSimConfig: SimConfig | null) {
    if (!map.loaded()) return;

    removeSimulationListener?.()
    removeSimulationListener = null
    if (currentOnMap) currentMarker.remove();
    currentOnMap = false

    editController?.dispose()
    editController = null

    simConfig = null

    if (!newSimConfig) return

    simConfig = newSimConfig

    removeSimulationListener = addSimulationListener(simConfig.id,
      (simData) => {

        if (!currentOnMap) {
          currentMarker.setLngLat([simData.position.longitude, simData.position.latitude])
          currentMarker.addTo(map)
          currentOnMap = true
          currentMarker.getElement().style.zIndex = "9999";
        }
        currentMarker.setLngLat([simData.position.longitude, simData.position.latitude])
      }
    )

    if (simConfig.spec) {
      editController = createEditController(simConfig, map)
    }

  }

  return new Promise<SimulationMap>(resolve => {
    map.once('load', () => {
      resolve(
        {
          map,
          attachSimConfig,
          editController,
          dispose: () => {
            removeSimulationListener?.()
            editController?.dispose()
            if (currentOnMap) currentMarker.remove();
            map.remove()
          }
        }
      )
    })
  })

}