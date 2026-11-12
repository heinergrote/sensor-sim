import {MapLibreMap} from "maplibre-gl";
import {SpecPath} from "@sensor-sim/shared";
import {ConfigSpecRenderer} from "./simulationMap";
import {MaplibreTerradrawControl} from "@watergis/maplibre-gl-terradraw";
import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css'


export function createSimulationPath(
  spec: SpecPath,
  map: MapLibreMap,
  handleSpecChange: (spec: SpecPath) => void
): ConfigSpecRenderer<SpecPath> {

  async function handleUpdate(coordinates: [number, number][]) {
    handleSpecChange({
      ...spec, start: coordinates[0], target: coordinates[1]
    })
  }


  const drawControl = new MaplibreTerradrawControl({
    modes: ['render', 'point', 'marker', 'linestring', 'freehand', 'freehand-linestring', 'select', 'delete-selection', 'delete', 'undo', 'redo', 'download'],
    open: true,
    showDeleteConfirmation: false,
  });
  map.addControl(drawControl, 'top-left');

  const draw = drawControl.getTerraDrawInstance()
  drawControl.activate()

  let featureId: string = ''

  updateSpec(spec)

  function updateSpec(spec: SpecPath) {

    if (draw) {
      draw.clear()

      const coordinates = [
        spec.start.map((coord) => +coord.toPrecision(9)),
        spec.target.map((coord) => +coord.toPrecision(9))
      ]

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

      // draw.on('change', (ids, type, context) => {
      //   if (ids.includes(featureId)) {
      //     if (type === 'update') {
      //       const feature = draw.getSnapshotFeature(featureId)
      //       if (feature && feature.geometry.type === 'LineString' && feature.geometry.coordinates.length === 2) {
      //         const coords = feature.geometry.coordinates.map((coord) => [coord[0], coord[1]] as [number, number])
      //         handleUpdate(coords)
      //       }
      //     }
      //   }
      // })

      draw.on('deselect', (id) => {
        if (id === featureId) {
          const feature = draw.getSnapshotFeature(featureId)
          if (feature && feature.geometry.type === 'LineString' && feature.geometry.coordinates.length === 2) {
            const coords = feature.geometry.coordinates.map((coord) => [coord[0], coord[1]] as [number, number])
            handleUpdate(coords)
          }
        }
      })


    }

  }

  function dispose() {
    map.removeControl(drawControl)
  }

  return {
    updateSpec,
    dispose
  }


}