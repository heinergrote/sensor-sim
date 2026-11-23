import {createEffect} from "solid-js";
import {MapMouseEvent, Marker} from "maplibre-gl";
import {SpecFixed} from "@sensor-sim/shared";
import {TbOutlineWorldLatitude, TbOutlineWorldLongitude} from "solid-icons/tb";
import {updateConfig} from "../../../service/configs.service";
import type {SpecEditorProps} from "./SpecEditor";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

/** No draft: every map click saves the position right away; the marker follows the (optimistic) spec. */
export default function FixedEditor(props: SpecEditorProps<SpecFixed>) {

  const marker = new Marker()

  // update the marker when the position changes
  // declared before mount effect, the marker needs position set, to be add-able
  createEffect(
    () => [...props.spec.position] as Mutable<typeof props.spec.position>,
    (position) => {
      marker.setLngLat(position)
    },
    {name: "fixedEditor.position"}
  )

  // add the marker to the map for as long as this editor is mounted
  createEffect(
    () => props.map,
    (map) => {
      marker.addTo(map)
      map.flyTo({center: marker.getLngLat()})

      const onClick = (e: MapMouseEvent) => {
        updateConfig(props.configId, {spec: {...props.spec, position: e.lngLat.toArray()}})
      }

      map.on('click', onClick)
      return () => {
        marker.remove()
        map.off('click', onClick)
      }

    },
    {name: "fixedEditor.marker"})

  return (
    <>
      <div class="flex gap-2 items-center">
        <TbOutlineWorldLatitude/>{props.spec.position[1].toFixed(5)}
      </div>
      <div class="flex gap-2 items-center">
        <TbOutlineWorldLongitude/>{props.spec.position[0].toFixed(5)}
      </div>
      Click the map to set the position
    </>
  )
}
