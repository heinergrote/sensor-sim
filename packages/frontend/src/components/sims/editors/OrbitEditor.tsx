import {createEffect, createMemo, createSignal, untrack} from "solid-js";
import {Marker} from "maplibre-gl";
import {SpecOrbit} from "@sensor-sim/shared";
import {getAzimuth, getDistance, getPosition} from "@sensor-sim/shared/geoUtils";
import {
  TbOutlineAngle,
  TbOutlineArrowBackUp,
  TbOutlineCloudUpload,
  TbOutlineRulerMeasure,
  TbOutlineWorldLatitude,
  TbOutlineWorldLongitude
} from "solid-icons/tb";
import {BsSpeedometer} from "solid-icons/bs";
import {updateConfig} from "../../../service/configs.service";
import {markerElement} from "../markerElement";
import type {SpecEditorProps} from "./SpecEditor";

type OrbitDraft = Pick<SpecOrbit, "center" | "radius" | "startAngle" | "speed">

const toDraft = (spec: SpecOrbit): OrbitDraft => ({
  center: [spec.center[0], spec.center[1]],
  radius: spec.radius,
  startAngle: spec.startAngle,
  speed: spec.speed
})

const sameDraft = (a: OrbitDraft, b: OrbitDraft) =>
  a.center[0] === b.center[0] &&
  a.center[1] === b.center[1] &&
  a.radius === b.radius &&
  a.startAngle === b.startAngle &&
  a.speed === b.speed

/**
 * Center marker (blue) moves the whole orbit; start marker (green) sets radius and start angle. Speed is part of
 * the draft too: committing it on its own would reset the draft and drop unsaved marker moves.
 */
export default function OrbitEditor(props: SpecEditorProps<SpecOrbit>) {

  // plain copy of the spec (no store proxies); follows the spec after a save or a remote update
  const [draft, setDraft] = createSignal<OrbitDraft>(() => toDraft(props.spec), {name: "orbitEditor.draft"})
  const dirty = createMemo(() => !sameDraft(draft(), toDraft(props.spec)), {name: "orbitEditor.dirty"})

  const startPosition = createMemo(
    () => getPosition(draft().center, draft().radius, draft().startAngle),
    {name: "orbitEditor.startPosition"}
  )

  const centerMarker = new Marker({draggable: true, element: markerElement('blue'), anchor: 'center'})
  const startMarker = new Marker({draggable: true, element: markerElement('green'), anchor: 'center'})

  // update the draft when the marker is drag ends
  const onCenterDragEnd = () => setDraft(d => ({...d, center: centerMarker.getLngLat().toArray()}))
  const onStartDragEnd = () => {
    const start = startMarker.getLngLat().toArray()
    setDraft(d => ({...d, radius: getDistance(d.center, start), startAngle: getAzimuth(d.center, start)}))
  }

  // add the markers to the map when the map is ready
  createEffect(
    () => props.map,
    (map) => {
      centerMarker.setLngLat([...untrack(draft).center]).addTo(map)
      startMarker.setLngLat([...untrack(startPosition)]).addTo(map)
      centerMarker.on('dragend', onCenterDragEnd)
      startMarker.on('dragend', onStartDragEnd)
      map.flyTo({center: centerMarker.getLngLat()})
      return () => {
        centerMarker.off('dragend', onCenterDragEnd)
        startMarker.off('dragend', onStartDragEnd)
        centerMarker.remove()
        startMarker.remove()
      }
    }, {name: "orbitEditor.markers"}
  )

  // move the markers when the center or start position changes
  createEffect(
    () => ({
      center: [...draft().center] as [number, number],
      start: [...startPosition()] as [number, number]
    }),
    ({center, start}) => {
      centerMarker.setLngLat(center)
      startMarker.setLngLat(start)
    }, {name: "orbitEditor.positions"}
  )

  // save the draft to remote
  async function save() {
    await updateConfig(props.configId, {spec: {...props.spec, ...draft()}})
  }

  return (
    <div class="flex flex-col gap-1">
      <div class="flex gap-2 items-center">
        <TbOutlineWorldLongitude/>{draft().center[0].toFixed(7)},
        <TbOutlineWorldLatitude/>{draft().center[1].toFixed(7)}
      </div>
      <div class="flex gap-2 items-center">
        <TbOutlineRulerMeasure/> {draft().radius.toFixed(2)}m
        <TbOutlineAngle/> {draft().startAngle.toFixed(2)}°
      </div>
      <div class="flex gap-2 items-center">
        <BsSpeedometer/><span>{draft().speed}m/s</span>
        <input type="range" min="0" max="40" value={draft().speed} class="range range-xs w-full"
               onInput={(e) => {
                 const speed = +e.currentTarget.value
                 setDraft(d => ({...d, speed}))
               }}/>
      </div>
      <div class="flex gap-2 justify-end">
        <button class="btn btn-sm" disabled={!dirty()} onClick={() => setDraft(toDraft(props.spec))}>
          <TbOutlineArrowBackUp/> Reset
        </button>
        <button class="btn btn-sm btn-primary" disabled={!dirty()} onClick={save}>
          <TbOutlineCloudUpload/> Save
        </button>
      </div>
    </div>
  )
}
