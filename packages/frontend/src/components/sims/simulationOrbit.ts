import {MapLibreMap, Marker} from "maplibre-gl";
import {SpecOrbit} from "@sensor-sim/shared";
import {getAzimuth, getDistance, getPosition} from "@sensor-sim/shared/geoUtils";
import {ConfigSpecRenderer} from "./simulationMap";

function createCenterMarkerElement(): HTMLElement {
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

function createStartMarkerElement(): HTMLElement {
  const svgMarker = `<svg width="48" height="96" viewBox="0 0 48 96" xmlns="http://w3.org">
     <circle cx="24" cy="48" r="2" fill="green"/>
     <line x1="24" y1="48" x2="24" y2="62" stroke="green" stroke-width="1"/>
     <circle cx="24" cy="78" r="16" fill="green" fill-opacity="0.2" stroke="green" stroke-width="1"/>
  </svg>`;
  const el = document.createElement('div');
  el.innerHTML = svgMarker;
  el.className = 'start-marker';
  el.style.cursor = 'pointer';
  return el;
}

export function createSimulationOrbit(
  spec: SpecOrbit,
  map: MapLibreMap,
  handleSpecChange: (spec: SpecOrbit) => void
): ConfigSpecRenderer<SpecOrbit> {

  const centerMarker = new Marker({
    draggable: true,
    element: createCenterMarkerElement(),
    anchor: 'center',
  })
  const startMarker = new Marker({
    draggable: true,
    element: createStartMarkerElement(),
    anchor: 'center',
  })

  updateSpec(spec)

  centerMarker.addTo(map)
  startMarker.addTo(map)

  async function handleUpdate() {

    // calculate new initial distance and azimuth
    const center = centerMarker.getLngLat().toArray()
    const current = startMarker.getLngLat().toArray()
    const radius = getDistance(center, current)
    const startAngle = getAzimuth(center, current)
    handleSpecChange({
      ...spec,
      center, radius, startAngle,
    })
  }

  centerMarker.on('dragend', handleUpdate);
  startMarker.on('dragend', handleUpdate);

  function updateSpec(spec: SpecOrbit) {
    centerMarker.setLngLat([...spec.center])
    const startPosition = getPosition(spec.center, spec.radius, spec.startAngle)
    startMarker.setLngLat([...startPosition])
  }

  function dispose() {
    centerMarker.remove()
    startMarker.remove()
  }

  return {
    updateSpec,
    dispose
  }

}