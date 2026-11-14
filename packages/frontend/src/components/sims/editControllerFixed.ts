import {MapLibreMap, Marker} from "maplibre-gl";
import {SimConfig, SpecFixed} from "@sensor-sim/shared";
import {SpecEditController} from "./simulationMap";
import {useSimConfigsApi} from "../../service/configs.service";
import {markerElement} from "./markerElement";

export function createEditControllerFixed(
  config: SimConfig,
  map: MapLibreMap,
): SpecEditController<SpecFixed> {

  // check for valid spec
  if (config.spec?.type !== 'fixed') throw new Error('Spec of type "fixed" is required')

  const spec = config.spec

  const marker = new Marker({
    draggable: true,
    element: markerElement('blue'),
    anchor: 'center',
  })

  update(spec)

  marker.addTo(map)
  marker.on('dragend', save);

  function update(spec: SpecFixed) {
    marker.setLngLat([...spec.position])
  }

  async function save() {
    const api = useSimConfigsApi()
    const position = marker.getLngLat().toArray()
    const newSpec = {
      ...spec, position
    }
    await api.update(config.id, {spec: newSpec})
  }

  function dispose() {
    marker.off('dragend', save)
    marker.remove()
  }

  return {
    update,
    save,
    dispose
  }

}