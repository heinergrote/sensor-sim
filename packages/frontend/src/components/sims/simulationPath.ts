import {MapLibreMap, Marker} from "maplibre-gl";
import {SpecPath} from "@sensor-sim/shared";
import {ConfigSpecRenderer} from "./simulationMap";

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


export function createSimulationPath(
  spec: SpecPath,
  map: MapLibreMap,
  handleSpecChange: (spec: SpecPath) => void
): ConfigSpecRenderer<SpecPath> {

  async function handleUpdate() {
    const start = startMarker.getLngLat().toArray()
    const target = targetMarker.getLngLat().toArray()
    handleSpecChange({
      ...spec, target, start
    })
  }

  const targetMarker = new Marker({
    draggable: true,
    element: createTargetMarkerElement(),
    anchor: 'center',
  })
  const startMarker = new Marker({
    draggable: true,
    element: createStartMarkerElement(),
    anchor: 'center',
  })

  updateSpec(spec)

  targetMarker.on('dragend', handleUpdate);
  startMarker.on('dragend', handleUpdate);

  targetMarker.addTo(map)
  startMarker.addTo(map)

  function updateSpec(spec: SpecPath) {
    targetMarker.setLngLat([...spec.target])
    startMarker.setLngLat([...spec.start])
  }

  function dispose() {
    targetMarker.remove()
    startMarker.remove()
  }

  return {
    updateSpec,
    dispose
  }


}