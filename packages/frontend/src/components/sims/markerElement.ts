export function markerElement(color: string): HTMLElement {
  const svgMarker = `<svg width="48" height="96" viewBox="0 0 48 96" xmlns="http://w3.org">
     <circle cx="24" cy="48" r="2" fill="${color}"/>
     <line x1="24" y1="48" x2="24" y2="62" stroke="${color}" stroke-width="1"/>
     <circle cx="24" cy="78" r="16" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1"/>
  </svg>`;
  const el = document.createElement('div');
  el.innerHTML = svgMarker;
  el.className = 'target-marker';
  el.style.cursor = 'pointer';
  return el;
}

export function currentMarkerElement(): HTMLElement {
  const svgMarker = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://w3.org">
     <circle cx="12" cy="12" r="2" fill="red" />
     <circle cx="12" cy="12" r="11" fill="red" fill-opacity="0.2" stroke="red" stroke-width="1"/>
  </svg>`;
  const el = document.createElement('div');
  el.innerHTML = svgMarker;
  el.className = 'target-marker';
  el.style.cursor = 'pointer';

  // make element transparent to all interactions
  el.style.pointerEvents = 'none';

  return el;
}