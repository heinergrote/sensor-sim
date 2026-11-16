import {GeolocateControl, MapLibreMap, Marker, NavigationControl, ScaleControl, setWorkerUrl} from "maplibre-gl";
import {addSimulationListener} from "../../service/simulation.service";
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

const mapStyle = import.meta.env.VITE_MAP_STYLE || window.location.origin + "/api/tiles/style.json";

/** The map and the selected sim's live position marker; spec editing lives in `editors/` (Solid components). */
export type SimulationMap = {
  map: MapLibreMap,
  /** follow the live position of this sim (or none) */
  attachSim: (simId: number | null) => void,
  dispose: () => void
}

/// -------------------------------------------------------------------

export async function createSimulationMap(
  element: HTMLDivElement,
  jwtToken: string | null,
): Promise<SimulationMap> {


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
        // add bearer token to requests going to our own server (the tile proxy), which in dev is
        // :4000 while the page runs on :3000 - so compare against the style's origin, not the page's
        if (url.startsWith(tileServerUrl + "/")) {
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

  // only handed out after `load`; `map.loaded()` is no guard (false again while tiles load)
  function attachSim(simId: number | null) {
    removeSimulationListener?.()
    removeSimulationListener = null
    if (currentOnMap) currentMarker.remove();
    currentOnMap = false

    if (simId === null) return

    removeSimulationListener = addSimulationListener(simId,
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

  }

  return new Promise<SimulationMap>(resolve => {
    map.once('load', () => {
      resolve(
        {
          map,
          attachSim,
          dispose: () => {
            removeSimulationListener?.()
            if (currentOnMap) currentMarker.remove();
            map.remove()
          }
        }
      )
    })
  })

}