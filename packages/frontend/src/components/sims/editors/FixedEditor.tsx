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
  // "lazy" add it to the map, if map is available
  createEffect(
    () => ({
      position: [...props.spec.position] as Mutable<typeof props.spec.position>,
      map: props.map
    }),
    ({position, map}) => {
      marker.setLngLat(position)
      if (map) {
        // marker._map: undocumented, but widely used
        if (!marker._map) {
          marker.addTo(map)
          map.flyTo({center: marker.getLngLat()})
        }
      }

      return () => {
        marker.remove()
      }
    },
    {name: "fixedEditor.position"}
  )

  createEffect(
    () => props.map,
    (map) => {
      const onClick = (e: MapMouseEvent) => {
        updateConfig(props.configId, {spec: {...props.spec, position: e.lngLat.toArray()}})
      }

      map.on('click', onClick)
      return () => {
        map.off('click', onClick)
      }

    },
    {name: "fixedEditor.map"})

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
