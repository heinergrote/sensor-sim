import {createEffect, createMemo, createSignal, Show, untrack} from "solid-js";
import {GeoPosition, SpecPath} from "@sensor-sim/shared";
import {
  TbOutlineArrowBackUp,
  TbOutlineArrowCapsule,
  TbOutlineArrowRight,
  TbOutlineArrowsRightLeft,
  TbOutlineCloudUpload,
  TbOutlinePoint,
  TbOutlinePointer,
  TbOutlinePolygon,
  TbOutlineRulerMeasure,
  TbOutlineScribble
} from "solid-icons/tb";
import {BsSpeedometer} from "solid-icons/bs";
import {updateConfig} from "../../../service/configs.service";
import type {SpecEditorProps} from "./SpecEditor";
import {
  TerraDraw,
  TerraDrawFreehandLineStringMode,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawRenderMode,
  TerraDrawSelectMode
} from "terra-draw";
import {TerraDrawMapLibreGLAdapter} from "terra-draw-maplibre-gl-adapter";
import {boundsOf, pathLength} from "@sensor-sim/shared/geoUtils";

type PathDraft = {
  waypoints: GeoPosition[],
  speed: number,
  editMode: string,
  playMode: "single" | "loop" | "reversing"
}

const toDraft = (spec: SpecPath): PathDraft => ({
  waypoints: spec.waypoints.map(([lng, lat]) => [lng, lat] as const),
  speed: spec.speed,
  editMode: spec.editMode,
  playMode: spec.playMode,
})

const sameWaypoints = (a: readonly GeoPosition[], b: readonly GeoPosition[]) =>
  a.length === b.length &&
  a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1])

const sameDraft = (a: PathDraft, b: PathDraft) =>
  sameWaypoints(a.waypoints, b.waypoints) &&
  a.speed === b.speed &&
  a.editMode === b.editMode &&
  a.playMode === b.playMode

// terra draw rejects coordinates with more than 9 significant digits
const toDrawPrecision = (waypoints: readonly GeoPosition[]): GeoPosition[] =>
  waypoints.map(([lng, lat]) => [+lng.toPrecision(9), +lat.toPrecision(9)] as const)

/**
 * Waypoints are edited with terradraw: a finished
 * line edit becomes the draft; Reset/save/remote updates redraw the line. Speed is part of the draft (see OrbitEditor).
 */
export default function PathEditor(props: SpecEditorProps<SpecPath>) {

  // plain copy of the saved spec. Copying tracks every waypoint tuple of the store (hundreds of sources), so the copy
  // runs untracked and is keyed on coarse markers instead: the spec object (replaced by the optimistic update on
  // save) and updatedAt (changes with every server write; refresh reconciles waypoints in place).
  const saved = createMemo(() => {
    void props.updatedAt // tracked only
    return untrack(() => toDraft(props.spec))
  }, {name: "pathEditor.saved", equals: sameDraft})

  const [draft, setDraft] = createSignal<PathDraft>(() => saved(), {name: "pathEditor.draft"})
  const dirty = createMemo(() => !sameDraft(draft(), saved()), {name: "pathEditor.dirty"})
  const isValidPath = createMemo(() => draft().waypoints.length >= 1, {name: "pathEditor.isValidPath"})

  const [autoSave, setAutoSave] = createSignal(true, {name: "pathEditor.autoSave"})

  const [terraDrawModeId, setTerraDrawModeId] = createSignal("select", {name: "pathEditor.terraDrawModeId"})

  const length = createMemo(() => {
    const waypoints = draft().waypoints
    return pathLength(waypoints)
  }, {name: "pathEditor.length"})


  // what render() last drew, in draw precision — lets the line effect skip redrawing when only non-waypoint draft
  // fields change (speed, playMode). onFinish resets it to force a redraw.
  let drawn: GeoPosition[] = []

  let terraDraw: TerraDraw | undefined
  let featureId: string | number | undefined

  function render(waypoints: readonly GeoPosition[], mode = "linestring") {
    if (!terraDraw) return

    drawn = toDrawPrecision(waypoints)
    terraDraw.clear()
    if (drawn.length === 0) {
      featureId = undefined
      return
    }

    const featureMode = drawn.length === 1 ? "point" : (mode === "point" ? "linestring" : mode)
    const result = terraDraw.addFeatures([{
      type: "Feature",
      geometry: drawn.length > 1 ? {
        type: "LineString",
        coordinates: drawn.map(([lng, lat]) => [lng, lat])
      } : {
        type: "Point",
        coordinates: [...drawn[0]]
      },
      properties: {mode: featureMode},
    }])

    if (result.length === 1 && result[0].id && result[0].valid) {

      featureId = result[0].id
      requestAnimationFrame(
        () => {
          if (featureId && terraDraw?.getMode() === "select") terraDraw?.selectFeature(featureId)
        }
      )

    } else {
      terraDraw.clear()
      featureId = undefined
    }

  }

  function onFinish(id: string | number) {
    if (!terraDraw) return
    const feature = terraDraw.getSnapshotFeature(id)
    if (!feature) return;

    let waypoints: GeoPosition[]
    if (feature.geometry.type === 'Point') {
      waypoints = [[feature.geometry.coordinates[0], feature.geometry.coordinates[1]] as const]
    } else if (feature.geometry.type === 'LineString' && feature.geometry.coordinates.length >= 2) {
      waypoints = feature.geometry.coordinates.map(([lng, lat]) => [lng, lat] as const)
    } else {
      return;
    }

    const editMode = feature.properties?.mode?.toString()
    setDraft(d => ({...d, waypoints, editMode: editMode || d.editMode}))
    // always redraw after a finish: render() clears the store, dropping the previous feature (a newly drawn
    // point/line is added next to it) and re-adding the result as the single feature, tagged by its geometry
    drawn = []

    const draw = terraDraw
    requestAnimationFrame(() => {
      if (terraDraw !== draw) return
      draw.setMode(terraDrawModeId())
      if (autoSave()) save()
    })

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
              point: {
                feature: {
                  draggable: true,
                },
              },
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
          new TerraDrawPointMode(),
          new TerraDrawLineStringMode(),
          new TerraDrawFreehandLineStringMode(),
        ],
      });

      terraDraw.start()
      terraDraw.on('finish', onFinish)

      // SimMap defers map.remove() until editors are cleaned up; should the map still be gone first, stop() would
      // hit the removed style (adapter.clear → getSource(...).setData), so a removed map just drops the instance
      let mapRemoved = false
      const onMapRemove = () => {
        mapRemoved = true
      }
      map.once('remove', onMapRemove)

      return () => {
        drawn = []
        featureId = undefined
        map.off('remove', onMapRemove)
        terraDraw?.off('finish', onFinish)
        if (!mapRemoved) terraDraw?.stop()
        terraDraw = undefined
      }
    }, {name: "pathEditor.drawControl"}
  )

  createEffect(
    () => ({map: props.map, mode: terraDrawModeId()}),
    ({mode}) => {
      if (!terraDraw) return
      terraDraw.setMode(mode)
      if (mode === "select" && featureId) {
        terraDraw.selectFeature(featureId)
      }
    },
    {name: "pathEditor.mode"}
  )

  // plain copy in compute — no store proxies in the apply phase
  createEffect(
    () => ({
      waypoints: draft().waypoints.map(([lng, lat]) => [lng, lat] as const),
      editMode: draft().editMode,
    }),
    ({waypoints, editMode}) => {
      if (!sameWaypoints(toDrawPrecision(waypoints), drawn))
        render(waypoints, editMode)
    },
    {name: "pathEditor.line"}
  )


  // fitBounds: track map + configId; read waypoints deliberately untracked in compute (dependency control)
  createEffect(
    () => ({map: props.map, configId: props.configId, waypoints: untrack(saved).waypoints}),
    ({map, waypoints}) => {
      if (waypoints.length === 0) return
      if (waypoints.length >= 2) {
        const box = boundsOf(waypoints)
        map.fitBounds([[box[0], box[1]], [box[2], box[3]]], {
          padding: 60,
          maxZoom: 18
        });
      } else {
        map.flyTo({center: [...waypoints[0]], zoom: 18})
      }
    },
    {name: "pathEditor.fitBounds"}
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
    await updateConfig(props.configId, {spec: {...props.spec, ...draft()}})
  }

  return (
    <div class="flex flex-col gap-1">
      <div class="flex gap-2 items-center">
        <TbOutlineRulerMeasure/> {length().toFixed(2)} m
        ({draft().editMode}{draft().waypoints.length > 1 ? ", " + draft().waypoints.length + " points" : ""})
      </div>
      <div class="flex gap-2 items-center">
        <BsSpeedometer/><span>{draft().speed}m/s</span>
        <input type="range" min="0" max="40" value={draft().speed} class="range range-xs w-full"
               onInput={(e) => {
                 const speed = +e.currentTarget.value
                 setDraft(d => ({...d, speed}))
               }}/>
      </div>

      <div class="join">
        <button class={["btn", "btn-sm", "join-item", draft().playMode === "single" ? "btn-primary" : ""]}
                onClick={() => setDraft(d => ({...d, playMode: "single"}))}
        >
          <TbOutlineArrowRight/> Single
        </button>
        <button class={["btn", "btn-sm", "join-item", draft().playMode === "loop" ? "btn-primary" : ""]}
                onClick={() => setDraft(d => ({...d, playMode: "loop"}))}
        >
          <TbOutlineArrowCapsule/> Loop
        </button>
        <button
          class={["btn", "btn-sm", "join-item", draft().playMode === "reversing" ? "btn-primary" : ""]}
          onClick={() => setDraft(d => ({...d, playMode: "reversing"}))}
        >
          <TbOutlineArrowsRightLeft/> Reversing
        </button>
      </div>

      <div class="flex gap-2 justify-end items-center">
        <label class="label">
          <input type="checkbox" checked={autoSave()} class="checkbox"
                 onChange={() => setAutoSave(!autoSave())}/>
          Autosave
        </label>

        <Show when={!autoSave()}>
          <button class="btn btn-sm btn-primary" disabled={!dirty()} onClick={() => setDraft(saved())}>
            <TbOutlineArrowBackUp/> Undo
          </button>
          <button class="btn btn-sm btn-primary" disabled={!(dirty() && isValidPath())} onClick={save}>
            <TbOutlineCloudUpload/> Save
          </button>
        </Show>

        <button class={["btn", "btn-sm", "btn-square", {"btn-primary": terraDrawModeId() === "select"}]}
                onClick={() => handleMode("select")}>
          <TbOutlinePointer/>
        </button>
        <button class={["btn", "btn-sm", {"btn-primary": terraDrawModeId() === "point"}]}
                onClick={() => handleMode("point")}>
          <TbOutlinePoint/>
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
