import {createEffect, untrack} from "solid-js";
import {Marker} from "maplibre-gl";
import {GeoPosition, SpecFixed} from "@sensor-sim/shared";
import {TbOutlineWorldLatitude, TbOutlineWorldLongitude} from "solid-icons/tb";
import {useSimConfigsApi} from "../../../service/configs.service";
import {markerElement} from "../markerElement";
import type {SpecEditorProps} from "./SpecEditor";

// plain copy: the spec's tuple is a store proxy, which must not be read outside a tracking scope (marker effects)
const copy = ([lng, lat]: GeoPosition): [number, number] => [lng, lat]

/** No draft: every drag end saves the position right away; the marker follows the (optimistic) spec. */
export default function FixedEditor(props: SpecEditorProps<SpecFixed>) {
  const api = useSimConfigsApi()

  const marker = new Marker(
    {
      draggable: true,
      element: markerElement('blue'),
      anchor: 'center'
    }
  )

  const onDragEnd = () => {
    const position = marker.getLngLat().toArray()
    api.update(props.configId, {spec: {...props.spec, position}})
  }

  // add the marker to the map for as long as this editor is mounted
  createEffect(
    () => props.map,
    (map) => {
      marker.setLngLat(untrack(() => copy(props.spec.position))).addTo(map)

      map.flyTo({center: marker.getLngLat()})
      marker.on('dragend', onDragEnd)

      return () => {
        marker.off('dragend', onDragEnd)
        marker.remove()
      }

    },
    {name: "fixedEditor.marker"})

  // keep the marker on the spec (save, rejected save, remote update)
  createEffect(
    () => copy(props.spec.position),
    (position) => {
      marker.setLngLat(position)
    }, {name: "fixedEditor.position"})

  return (
    <div class="flex gap-2 items-center">
      <TbOutlineWorldLatitude/>{props.spec.position[1].toFixed(5)},
      <TbOutlineWorldLongitude/>{props.spec.position[0].toFixed(5)}
    </div>
  )
}
