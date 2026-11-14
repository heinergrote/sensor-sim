import {createEffect, createMemo, createSignal} from "solid-js";
import {GeoPosition, SpecPath} from "@sensor-sim/shared";
import {
  TbOutlineArrowBackUp,
  TbOutlineCloudUpload,
  TbOutlineEdit,
  TbOutlineRulerMeasure,
  TbOutlineScribble
} from "solid-icons/tb";
import {BsSpeedometer} from "solid-icons/bs";
import {useSimConfigsApi} from "../../../service/configs.service";
import type {SpecEditorProps} from "./SpecEditor";
import {TerraDraw, TerraDrawFreehandLineStringMode, TerraDrawLineStringMode, TerraDrawSelectMode} from "terra-draw";
import {TerraDrawMapLibreGLAdapter} from "terra-draw-maplibre-gl-adapter";
import {pathLength} from "@sensor-sim/shared/geoUtils";

type PathDraft = { waypoints: GeoPosition[], speed: number }

const toDraft = (spec: SpecPath): PathDraft => ({
  waypoints: spec.waypoints.map(([lng, lat]) => [lng, lat] as const),
  speed: spec.speed
})

const sameWaypoints = (a: readonly GeoPosition[], b: readonly GeoPosition[]) =>
  a.length === b.length &&
  a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1])

const sameDraft = (a: PathDraft, b: PathDraft) =>
  a.speed === b.speed &&
  sameWaypoints(a.waypoints, b.waypoints)

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
  const isValidPath = createMemo(() => draft().waypoints.length >= 2, {name: "pathEditor.isValidPath"})
  const length = createMemo(() => {
    const waypoints = draft().waypoints
    return waypoints.length >= 2 ? pathLength(waypoints) : 0
  }, {name: "pathEditor.length"})


  // what the draw instance currently shows, in draw precision — lets the draft effect skip redrawing a line the
  // user just edited (that would reset terra draw's selection mid-edit)
  let drawn: GeoPosition[] = []

  let terraDraw: TerraDraw | undefined
  let featureId: string | number | undefined

  function render(waypoints: readonly GeoPosition[]) {
    if (!terraDraw) return
    drawn = toDrawPrecision(waypoints)
    terraDraw.clear()
    const result = terraDraw.addFeatures([{
      type: "Feature",
      geometry: {type: "LineString", coordinates: drawn.map(([lng, lat]) => [lng, lat])},
      properties: {mode: "linestring"},
    }])

    if (result.length === 1 && result[0].id && result[0].valid) {
      featureId = result[0].id
      terraDraw.selectFeature(featureId)
    } else {
      terraDraw.clear()
      featureId = undefined
    }
  }

  function onFinish(id: string | number) {
    if (!terraDraw) return
    const feature = terraDraw.getSnapshotFeature(id)
    if (feature?.geometry.type !== 'LineString' || feature.geometry.coordinates.length < 2) return
    drawn = feature.geometry.coordinates.map(([lng, lat]) => [lng, lat] as const)
    setDraft(d => ({...d, waypoints: drawn}))
  }

  createEffect(
    () => props.map,
    (map) => {
      terraDraw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({map}),
        modes: [
          new TerraDrawSelectMode({
            allowManualSelection: true,
            allowManualDeselection: true,
            flags: {
              linestring: {
                feature: {
                  draggable: true,
                  coordinates: {
                    midpoints: true,
                    draggable: true,
                    deletable: true,
                  },
                },
              },
            }

          }),
          new TerraDrawLineStringMode(),
          new TerraDrawFreehandLineStringMode(),
        ],
      });

      terraDraw.start()
      // existing path starts selected
      terraDraw.setMode('select')
      terraDraw?.on('finish', onFinish)

      return () => {
        drawn = []
        terraDraw?.off('finish', onFinish)
        terraDraw?.stop()
      }
    }, {name: "pathEditor.drawControl"})

  // plain copy in compute — no store proxies in the apply phase
  createEffect(
    () => draft().waypoints.map(([lng, lat]) => [lng, lat] as const),
    (waypoints) => {
      if (!sameWaypoints(toDrawPrecision(waypoints), drawn))
        render(waypoints)
    },
    {name: "pathEditor.line"})


  function newPath(mode: "linestring" | "freehand-linestring") {
    setDraft(d => ({...d, waypoints: []}))
    terraDraw?.clear()
    terraDraw?.setMode(mode)
  }

  async function save() {
    if (!isValidPath()) return
    await api.update(props.configId, {spec: {...props.spec, ...draft()}})
  }

  return (
    <div class="flex flex-col gap-1">
      <div class="flex gap-2 items-center">
        <TbOutlineRulerMeasure/> {length().toFixed(2)} m ({draft().waypoints.length} points)
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
        <button class="btn btn-sm btn-primary" disabled={!(dirty() && isValidPath())} onClick={save}>
          <TbOutlineCloudUpload/> Save
        </button>
        <button class="btn btn-sm btn-primary" onClick={() => newPath("linestring")}>
          <TbOutlineEdit/> New
        </button>
        <button class="btn btn-sm btn-primary" onClick={() => newPath("freehand-linestring")}>
          <TbOutlineScribble/> New
        </button>
      </div>
    </div>
  )
}
