import {Map as MapLibre, Marker, NavigationControl} from "maplibre-gl";
import {SimState} from "@sensor-sim/shared";
//import {FeatureCollection} from "geojson";

export type SimulationMap = {
  map: MapLibre,
  update: (simState: SimState) => void,
  dispose: () => void
}

export function createSimulationMap(
  element: HTMLDivElement,
  simState: SimState,
  onMapReady: () => void,
  onUpdateTarget: (lat: number, lng: number) => void,
) {

  let targetMarker: Marker | null = null;
  let currentMarker: Marker | null = null;

  let dragging = false;

  const map = new MapLibre({
    container: element,
    style: `/api/maptiler/maps/streets-v2/style.json`,
    center: [simState.target.latitude, simState.target.longitude],
    zoom: 16,
    canvasContextAttributes: {
      preserveDrawingBuffer: true
    }
  });

  map.addControl(new NavigationControl(), 'top-right');

  map.on('load', () => {

    const {
      target: {latitude: targetLat, longitude: targetLng},
      current: {latitude: currentLat, longitude: currentLng},
    } = simState;

    const newCurrentMarker = new Marker({
      draggable: false,
      color: 'red'
    }).setLngLat([currentLng, currentLat]);

    const newTargetMarker = new Marker({
      draggable: true,
      color: 'blue'
    }).setLngLat([targetLng, targetLat]);

    newTargetMarker.on('dragend', () => {
      onUpdateTarget(
        newTargetMarker.getLngLat().lat,
        newTargetMarker.getLngLat().lng,
      )
      dragging = false;
    });
    newTargetMarker.on('dragstart', () => {
      dragging = true;
    });

    currentMarker = newCurrentMarker;
    targetMarker = newTargetMarker;

    currentMarker.addTo(map);
    targetMarker.addTo(map);
    onMapReady();
  });

  const update = (simState: SimState) => {

    const {
      target: {latitude: targetLat, longitude: targetLng},
      current: {latitude: currentLat, longitude: currentLng},
    } = simState;

    if (targetMarker && !dragging) {
      targetMarker.setLngLat([targetLng, targetLat]);
    }
    // if location is not visible, don't fly to it
    if (!map.getBounds().contains([targetLng, targetLat])) {
      map.setCenter([targetLng, targetLat]);
    }

    if (currentMarker) {
      currentMarker.setLngLat([currentLng, currentLat]);
    }
  }

  // map.on('mouseenter', 'locations', () => {
  //   map.getCanvas().style.cursor = 'pointer';
  // });
  //
  // map.on('mouseleave', 'locations', () => {
  //   map.getCanvas().style.cursor = '';
  // });

  return {
    map,
    update,
    dispose: () => {
      map.remove()
    }
  }

}