import {MapLibreMap, Marker} from "maplibre-gl";
import {SimConfig, SpecOrbit} from "@sensor-sim/shared";
import {getAzimuth, getDistance, getPosition} from "@sensor-sim/shared/geoUtils";
import {SpecEditController} from "./simulationMap";
import {useSimConfigsApi} from "../../service/configs.service";
import {markerElement} from "./markerElement";

export function createEditControllerOrbit(
  config: SimConfig,
  map: MapLibreMap,
): SpecEditController<SpecOrbit> {

  // check for valid spec
  if (config.spec?.type !== 'orbit') throw new Error('Spec of type "orbit" is required')
  const spec = config.spec

  const centerMarker = new Marker({
    draggable: true,
    element: markerElement('blue'),
    anchor: 'center',
  })
  const startMarker = new Marker({
    draggable: true,
    element: markerElement('green'),
    anchor: 'center',
  })

  update(spec)

  centerMarker.addTo(map)
  startMarker.addTo(map)

  function update(spec: SpecOrbit) {
    centerMarker.setLngLat([...spec.center])
    const startPosition = getPosition(spec.center, spec.radius, spec.startAngle)
    startMarker.setLngLat([...startPosition])
  }

  async function save() {
    const api = useSimConfigsApi()

    const center = centerMarker.getLngLat().toArray()
    const current = startMarker.getLngLat().toArray()
    const radius = getDistance(center, current)
    const startAngle = getAzimuth(center, current)

    const newSpec = {
      ...spec, center, radius, startAngle,

    }
    await api.update(config.id, {spec: newSpec})
  }

  function dispose() {
    centerMarker.remove()
    startMarker.remove()
  }

  return {
    update,
    save,
    dispose
  }

}