import {createEffect, createMemo, createSignal, untrack} from "solid-js";
import {Marker} from "maplibre-gl";
import {GeoPosition, SpecFixed} from "@sensor-sim/shared";
import {
  TbOutlineArrowBackUp,
  TbOutlineCloudUpload,
  TbOutlineWorldLatitude,
  TbOutlineWorldLongitude
} from "solid-icons/tb";
import {useSimConfigsApi} from "../../../service/configs.service";
import {markerElement} from "../markerElement";
import type {SpecEditorProps} from "./SpecEditor";

const samePosition = (a: GeoPosition, b: GeoPosition) => a[0] === b[0] && a[1] === b[1]

// plain copy: the spec's tuple is a store proxy, which must not be read outside a tracking scope (marker effect)
const copy = ([lng, lat]: GeoPosition): GeoPosition => [lng, lat]

export default function FixedEditor(props: SpecEditorProps<SpecFixed>) {
  const api = useSimConfigsApi()

  // Draft of the position: follows the spec (also after a save or a remote update), takes drags immediately.
  const [draft, setDraft] = createSignal<GeoPosition>(() => copy(props.spec.position), {name: "fixedEditor.draft"})

  const dirty = createMemo(() => !samePosition(draft(), props.spec.position), {name: "fixedEditor.dirty"})

  const marker = new Marker(
    {
      draggable: true,
      element: markerElement('blue'),
      anchor: 'center'
    }
  )


  const onDragEnd = () => setDraft(marker.getLngLat().toArray())

  // add the marker to the map for as long as this editor is mounted
  createEffect(
    () => props.map,
    (map) => {
      marker.setLngLat([...untrack(draft)]).addTo(map)
      marker.on('dragend', onDragEnd)

      return () => {
        marker.off('dragend', onDragEnd)
        marker.remove()
      }

    },
    {name: "fixedEditor.marker"})

  // keep the marker on the draft (reset, save, remote update); plain copy — no store proxy in the apply phase
  createEffect(
    () => [...draft()] as [number, number],
    (position) => {
      marker.setLngLat(position)
    }, {name: "fixedEditor.position"})

  async function save() {
    await api.update(props.configId, {spec: {...props.spec, position: draft()}})
  }

  return (
    <div class="flex flex-wrap gap-2 items-center">
      <TbOutlineWorldLatitude/>{draft()[1].toFixed(5)},
      <TbOutlineWorldLongitude/>{draft()[0].toFixed(5)}
      <div class="flex-1"/>
      <button class="btn btn-sm" disabled={!dirty()} onClick={() => setDraft(copy(props.spec.position))}>
        <TbOutlineArrowBackUp/> Reset
      </button>
      <button class="btn btn-sm btn-primary" disabled={!dirty()} onClick={save}>
        <TbOutlineCloudUpload/> Save
      </button>
    </div>
  )
}
