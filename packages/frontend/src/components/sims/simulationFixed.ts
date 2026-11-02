import {MapLibreMap, Marker} from "maplibre-gl";
import {SpecFixed} from "@sensor-sim/shared";
import {ConfigSpecRenderer} from "./simulationMap";

function createMarkerElement(): HTMLElement {
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

export function createSimulationFixed(
  spec: SpecFixed,
  map: MapLibreMap,
  handleSpecChange: (spec: SpecFixed) => void
): ConfigSpecRenderer<SpecFixed> {

  const marker = new Marker({
    draggable: true,
    element: createMarkerElement(),
    anchor: 'center',
  })

  updateSpec(spec)
  marker.addTo(map)

  async function handleUpdate() {
    const {lng, lat} = marker.getLngLat()
    handleSpecChange({
      ...spec,
      latitude: lat, longitude: lng
    })
  }

  marker.on('dragend', handleUpdate);

  function updateSpec(spec: SpecFixed) {
    marker.setLngLat([spec.longitude, spec.latitude])
  }

  function dispose() {
    marker.remove()
  }

  return {
    updateSpec,
    dispose
  }

}