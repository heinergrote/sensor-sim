import {createEffect, createMemo, createSignal, onCleanup, Show} from "solid-js";
import {MapMouseEvent, Marker} from "maplibre-gl";
import {GeoPosition, SpecOrbit} from "@sensor-sim/shared";
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

  const [autoSave, setAutoSave] = createSignal(true, {name: "orbitEditor.autoSave"})

  const startPosition = createMemo(
    () => getPosition(draft().center, draft().radius, draft().startAngle),
    {name: "orbitEditor.startPosition"}
  )


  const centerMarker = new Marker({draggable: true, element: markerElement('blue'), anchor: 'center'})
  const startMarker = new Marker({draggable: true, element: markerElement('green'), anchor: 'center'})
  const onCenterDragEnd = () => {
    updateCenter(centerMarker.getLngLat().toArray())
  }
  const onStartDragEnd = () => {
    updateStart(startMarker.getLngLat().toArray())
  }
  centerMarker.on('dragend', onCenterDragEnd)
  startMarker.on('dragend', onStartDragEnd)
  onCleanup(() => {
    centerMarker.off('dragend', onCenterDragEnd)
    startMarker.off('dragend', onStartDragEnd)
    centerMarker.remove()
    startMarker.remove()
  })


  function updateCenter(position: GeoPosition) {
    setDraft(d => ({...d, center: position}))
    if (autoSave()) requestAnimationFrame(
      () => save()
    )
  }

  function updateStart(position: GeoPosition) {
    setDraft(d => ({...d, radius: getDistance(d.center, position), startAngle: getAzimuth(d.center, position)}))
    if (autoSave()) requestAnimationFrame(
      () => save()
    )
  }

  // save the draft to remote
  async function save() {
    await updateConfig(props.configId, {spec: {...props.spec, ...draft()}})
  }

  // update the markers when the draft changes
  // "lazy" add them to the map, if map is available
  createEffect(
    () => ({
      center: [...draft().center] as [number, number],
      start: [...startPosition()] as [number, number],
      map: props.map
    }),

    ({map, center, start}) => {
      centerMarker.setLngLat(center);
      startMarker.setLngLat(start)

      if (map) {
        // marker._map: undocumented, but widely used
        if (!centerMarker._map) {
          centerMarker.addTo(map)
          map.flyTo({center: centerMarker.getLngLat()})
        }
        if (!startMarker._map) startMarker.addTo(map)
      }

      return () => {
        centerMarker.remove()
        startMarker.remove()
      }

    },
    {name: "orbitEditor.positions"})

  // add the markers to the map when the map is ready
  createEffect(
    () => props.map,
    (map) => {
      const onClick = (e: MapMouseEvent) => {
        updateCenter(e.lngLat.toArray())
      }

      map.on('click', onClick)
      return () => {
        map.off('click', onClick)
      }
    },
    {name: "orbitEditor.map"}
  )

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

        <label class="label">
          <input type="checkbox" checked={autoSave()} class="checkbox"
                 onChange={() => setAutoSave(!autoSave())}/>
          Autosave
        </label>
        <Show when={!autoSave()}>
          <button class="btn btn-sm" disabled={!dirty()} onClick={() => setDraft(toDraft(props.spec))}>
            <TbOutlineArrowBackUp/> Undo
          </button>
          <button class="btn btn-sm btn-primary" disabled={!dirty()} onClick={save}>
            <TbOutlineCloudUpload/> Save
          </button>
        </Show>
      </div>
    </div>
  )
}
