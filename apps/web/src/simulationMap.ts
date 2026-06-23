import {Map as MapLibre, Marker, NavigationControl} from "maplibre-gl";
//import {FeatureCollection} from "geojson";

export type SimulationMap = {
  map: MapLibre,
  setLocation: (lat: number, lng: number) => void,
  dispose: () => void
}

export function createSimulationMap(
  element: HTMLDivElement,
  lat: number,
  lng: number,
  onMapReady: () => void,
  onUpdateLocation: (lat: number, lng: number) => void,
) {

  let marker: Marker | null = null;

  const map = new MapLibre({
    container: element,
    style: `/api/maptiler/maps/streets-v2/style.json`,
    center: [lng, lat],
    zoom: 16,
    canvasContextAttributes: {
      preserveDrawingBuffer: true
    }
  });

  map.addControl(new NavigationControl(), 'top-right');

  map.on('load', () => {
    console.log("Map loaded, adding marker: ", lat, lng);
    const newMarker = new Marker({draggable: true}).setLngLat([lng, lat]).addTo(map);
    newMarker.on('dragend', () => onUpdateLocation(newMarker.getLngLat().lat, newMarker.getLngLat().lng));
    marker = newMarker;
    onMapReady();
  });

  const setLocation = (lat: number, lng: number) => {
    if (marker) {
      marker.setLngLat([lng, lat]);
    }
    // if location is not visible, don't fly to it
    if (!map.getBounds().contains([lng, lat])) {
      map.setCenter([lng, lat]);
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
    setLocation,
    dispose: () => {
      map.remove()
    }
  }

}