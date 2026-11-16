import {createEffect, createMemo, createSignal, untrack} from "solid-js";
import {GeoPosition, SpecPath} from "@sensor-sim/shared";
import {
  TbOutlineArrowBackUp,
  TbOutlineCloudUpload,
  TbOutlinePointer,
  TbOutlinePolygon,
  TbOutlineRulerMeasure,
  TbOutlineScribble
} from "solid-icons/tb";
import {BsSpeedometer} from "solid-icons/bs";
import {useSimConfigsApi} from "../../../service/configs.service";
import type {SpecEditorProps} from "./SpecEditor";
import {
  TerraDraw,
  TerraDrawFreehandLineStringMode,
  TerraDrawLineStringMode,
  TerraDrawRenderMode,
  TerraDrawSelectMode
} from "terra-draw";
import {TerraDrawMapLibreGLAdapter} from "terra-draw-maplibre-gl-adapter";
import {pathLength} from "@sensor-sim/shared/geoUtils";
import {LngLatBounds} from "maplibre-gl";

type PathDraft = { waypoints: GeoPosition[], speed: number, mode: string }

const toDraft = (spec: SpecPath): PathDraft => ({
  waypoints: spec.waypoints.map(([lng, lat]) => [lng, lat] as const),
  speed: spec.speed,
  mode: spec.mode
})

const sameWaypoints = (a: readonly GeoPosition[], b: readonly GeoPosition[]) =>
  a.length === b.length &&
  a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1])

const sameDraft = (a: PathDraft, b: PathDraft) =>
  sameWaypoints(a.waypoints, b.waypoints) &&
  a.speed === b.speed &&
  a.mode === b.mode

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

  const [terraDrawModeId, setTerraDrawModeId] = createSignal(() => "select", {name: "pathEditor.terraDrawModeId"})

  const length = createMemo(() => {
    const waypoints = draft().waypoints
    return waypoints.length >= 2 ? pathLength(waypoints) : 0
  }, {name: "pathEditor.length"})


  // what the draw instance currently shows, in draw precision — lets the draft effect skip redrawing a line the
  // user just edited (that would reset terra draw's selection mid-edit)
  let drawn: GeoPosition[] = []

  let terraDraw: TerraDraw | undefined
  let featureId: string | number | undefined

  function render(waypoints: readonly GeoPosition[], mode = "linestring") {
    if (!terraDraw) return
    drawn = toDrawPrecision(waypoints)
    terraDraw.clear()
    const result = terraDraw.addFeatures([{
      type: "Feature",
      geometry: {type: "LineString", coordinates: drawn.map(([lng, lat]) => [lng, lat])},
      properties: {mode},
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
    const drawMode = feature?.properties?.mode?.toString()
    setDraft(d => ({...d, waypoints: drawn, mode: drawMode || d.mode}))

    setTerraDrawModeId("select")

  }

  createEffect(
    () => props.map,
    (map) => {

      terraDraw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({map}),
        modes: [
          new TerraDrawRenderMode({
            modeName: 'default', styles: {}
          }),
          new TerraDrawSelectMode({
            allowManualSelection: true,
            allowManualDeselection: true,
            flags: {
              linestring: {
                feature: {
                  draggable: true,
                  selfIntersectable: true,
                  coordinates: {
                    midpoints: true,
                    draggable: true,
                    deletable: true,
                  },
                },
              },
              'freehand-linestring': {
                feature: {
                  draggable: true,
                  selfIntersectable: true,
                  coordinates: {
                    midpoints: false,
                    draggable: true,
                    deletable: true,
                  },
                },
              },
              freehand: {
                feature: {
                  draggable: true,
                  selfIntersectable: true,
                  coordinates: {
                    midpoints: false,
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
      terraDraw.setMode(untrack(terraDrawModeId))
      terraDraw.on('finish', onFinish)

      // SimMap defers map.remove() until editors are cleaned up; should the map still be gone first, stop() would
      // hit the removed style (adapter.clear → getSource(...).setData), so a removed map just drops the instance
      let mapRemoved = false
      const onMapRemove = () => {
        mapRemoved = true
      }
      map.once('remove', onMapRemove)


      const coords = untrack(() => props.spec.waypoints.map(([lng, lat]) => ({lng, lat})))
      if (coords.length > 0) {
        const bounds = new LngLatBounds(coords[0], coords[0]);
        for (const coord of coords) {
          bounds.extend(coord);
        }
        map.fitBounds(bounds, {
          padding: 200,
          maxZoom: 18
        });
      }


      return () => {
        drawn = []
        featureId = undefined
        map.off('remove', onMapRemove)
        terraDraw?.off('finish', onFinish)
        if (!mapRemoved) terraDraw?.stop()
        terraDraw = undefined
      }
    }, {name: "pathEditor.drawControl"})

  // plain copy in compute — no store proxies in the apply phase
  createEffect(
    () => ({
      waypoints: draft().waypoints.map(([lng, lat]) => [lng, lat] as const),
      mode: draft().mode
    }),
    ({waypoints, mode}) => {
      if (!sameWaypoints(toDrawPrecision(waypoints), drawn))
        render(waypoints, mode)
    },
    {name: "pathEditor.line"})


  createEffect(
    () => terraDrawModeId(),
    (mode) => {
      if (!terraDraw) return
      terraDraw.setMode(mode)
      if (mode === "select") {
        if (featureId) terraDraw.selectFeature(featureId)
      }
    }
  )

  function handleMode(mode: string) {
    if (mode === terraDrawModeId()) {
      setTerraDrawModeId("default")
    } else {
      setTerraDrawModeId(mode)
    }
  }

  async function save() {
    if (!isValidPath()) return
    await api.update(props.configId, {spec: {...props.spec, ...draft()}})
  }

  return (
    <div class="flex flex-col gap-1">
      <div class="flex gap-2 items-center">
        <TbOutlineRulerMeasure/> {length().toFixed(2)} m ({draft().mode}, {draft().waypoints.length} points)
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
        <button class="btn btn-sm btn-primary" disabled={!dirty()} onClick={() => setDraft(toDraft(props.spec))}>
          <TbOutlineArrowBackUp/> Reset
        </button>
        <button class="btn btn-sm btn-primary" disabled={!(dirty() && isValidPath())} onClick={save}>
          <TbOutlineCloudUpload/> Save
        </button>
        <button class={["btn", "btn-sm", "btn-square", {"btn-primary": terraDrawModeId() === "select"}]}
                onClick={() => handleMode("select")}>
          <TbOutlinePointer/>
        </button>
        <button class={["btn", "btn-sm", {"btn-primary": terraDrawModeId() === "linestring"}]}
                onClick={() => handleMode("linestring")}>
          <TbOutlinePolygon/>
        </button>
        <button class={["btn", "btn-sm", {"btn-primary": terraDrawModeId() === "freehand-linestring"}]}
                onClick={() => handleMode("freehand-linestring")}>
          <TbOutlineScribble/>
        </button>
      </div>
    </div>
  )
}
