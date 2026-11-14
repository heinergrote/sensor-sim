import {createEffect, createMemo, createSignal, For} from "solid-js";
import {MaplibreTerradrawControl} from "@watergis/maplibre-gl-terradraw";
import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css'
import {GeoPosition, SpecPath} from "@sensor-sim/shared";
import {
  TbOutlineArrowBackUp,
  TbOutlineCloudUpload,
  TbOutlineWorldLatitude,
  TbOutlineWorldLongitude
} from "solid-icons/tb";
import {BsSpeedometer} from "solid-icons/bs";
import {useSimConfigsApi} from "../../../service/configs.service";
import type {SpecEditorProps} from "./SpecEditor";

type PathDraft = { waypoints: GeoPosition[], speed: number }

const toDraft = (spec: SpecPath): PathDraft =>
  ({waypoints: spec.waypoints.map(([lng, lat]) => [lng, lat] as const), speed: spec.speed})

const sameWaypoints = (a: readonly GeoPosition[], b: readonly GeoPosition[]) =>
  a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1])

const sameDraft = (a: PathDraft, b: PathDraft) => a.speed === b.speed && sameWaypoints(a.waypoints, b.waypoints)

// terra draw rejects coordinates with more than 9 significant digits
const toDrawPrecision = (waypoints: readonly GeoPosition[]): GeoPosition[] =>
  waypoints.map(([lng, lat]) => [+lng.toPrecision(9), +lat.toPrecision(9)] as const)

/**
 * Waypoints are edited with the MapLibre terradraw control (to be replaced by plain Terra Draw): a finished
 * line edit becomes the draft; Reset/save/remote updates redraw the line. Speed is part of the draft (see OrbitEditor).
 */
export default function PathEditor(props: SpecEditorProps<SpecPath>) {
  const api = useSimConfigsApi()

  const [draft, setDraft] = createSignal<PathDraft>(() => toDraft(props.spec), {name: "pathEditor.draft"})
  const dirty = createMemo(() => !sameDraft(draft(), toDraft(props.spec)), {name: "pathEditor.dirty"})

  const drawControl = new MaplibreTerradrawControl({
    modes: ['render', 'linestring', 'select', 'delete-selection', 'delete', 'undo', 'redo'],
    open: true,
    showDeleteConfirmation: false,
  })

  // what the draw instance currently shows, in draw precision — lets the draft effect skip redrawing a line the
  // user just edited (that would reset terra draw's selection mid-edit)
  let drawn: GeoPosition[] = []

  function render(waypoints: readonly GeoPosition[]) {
    const draw = drawControl.getTerraDrawInstance()
    if (!draw) return
    drawn = toDrawPrecision(waypoints)
    draw.clear()
    draw.addFeatures([{
      type: "Feature",
      geometry: {type: "LineString", coordinates: drawn.map(([lng, lat]) => [lng, lat])},
      properties: {mode: "linestring"},
    }])
  }

  function onFinish(id: string | number) {
    const feature = drawControl.getTerraDrawInstance()?.getSnapshotFeature(id)
    if (feature?.geometry.type !== 'LineString' || feature.geometry.coordinates.length < 2) return
    drawn = feature.geometry.coordinates.map(([lng, lat]) => [lng, lat] as const)
    setDraft(d => ({...d, waypoints: drawn}))
  }

  createEffect(() => props.map, (map) => {
    map.addControl(drawControl, 'top-left')
    drawControl.activate()
    const draw = drawControl.getTerraDrawInstance()
    draw?.on('finish', onFinish)
    return () => {
      draw?.off('finish', onFinish)
      map.removeControl(drawControl)
      drawn = []
    }
  }, {name: "pathEditor.drawControl"})

  // plain copy in compute — no store proxies in the apply phase
  createEffect(() => draft().waypoints.map(([lng, lat]) => [lng, lat] as const), (waypoints) => {
    if (!sameWaypoints(toDrawPrecision(waypoints), drawn)) render(waypoints)
  }, {name: "pathEditor.line"})

  async function save() {
    await api.update(props.configId, {spec: {...props.spec, ...draft()}})
  }

  return (
    <div class="flex flex-col gap-1">
      <For each={draft().waypoints} keyed={false}>
        {(waypoint) =>
          <div class="flex gap-1 items-center">
            <TbOutlineWorldLatitude/>{waypoint()[1].toFixed(7)},
            <TbOutlineWorldLongitude/>{waypoint()[0].toFixed(7)}
          </div>
        }
      </For>
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
