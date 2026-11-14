import {MapLibreMap} from "maplibre-gl";
import {SimConfig, SpecPath} from "@sensor-sim/shared";
import {SpecEditController} from "./simulationMap";
import {MaplibreTerradrawControl} from "@watergis/maplibre-gl-terradraw";
import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css'
import {useSimConfigsApi} from "../../service/configs.service";


export function createEditControllerPath(
  config: SimConfig,
  map: MapLibreMap,
): SpecEditController<SpecPath> {

  // check for valid spec
  if (config.spec?.type !== 'path') throw new Error('Spec of type "path" is required')
  const spec = config.spec

  const drawControl = new MaplibreTerradrawControl({
    modes: ['render', 'point', 'marker', 'linestring', 'freehand', 'freehand-linestring', 'select', 'delete-selection', 'delete', 'undo', 'redo', 'download'],
    open: true,
    showDeleteConfirmation: false,
  });
  map.addControl(drawControl, 'top-left');

  const draw = drawControl.getTerraDrawInstance()
  drawControl.activate()

  let featureId: string = ''

  update(spec)

  function update(spec: SpecPath) {

    if (draw) {
      draw.clear()

      // terra draw expects lower precision
      const coordinates = spec.waypoints.map((coord) => [
        +coord[0].toPrecision(9),
        +coord[1].toPrecision(9)
      ])

      const result = draw.addFeatures(
        [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates
            },
            properties: {
              mode: "linestring",
            },
          },
        ]
      )

      if (result[0].id) {
        featureId = result[0].id.toString()
      }

    }

  }

  async function save() {
    const api = useSimConfigsApi()

    if (!draw) return

    const feature = draw.getSnapshotFeature(featureId)
    if (feature && feature.geometry.type === 'LineString' && feature.geometry.coordinates.length >= 2) {
      const coords = feature.geometry.coordinates.map((coord) => [coord[0], coord[1]] as [number, number])
      const waypoints = coords.map((coord) => [+coord[0], +coord[1]] as const)
      const newSpec = {
        ...spec, waypoints
      }
      await api.update(config.id, {spec: newSpec})

    }


  }

  function dispose() {
    map.removeControl(drawControl)
  }

  return {
    update: update,
    save,
    dispose
  }


}