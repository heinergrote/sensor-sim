import {Spec, SpecType} from "@sensor-sim/shared";
import {TbOutlineCircle, TbOutlineMapPin, TbOutlinePolygon} from "solid-icons/tb";
import {updateConfig} from "../../../service/configs.service";
import type {SpecEditorProps} from "./SpecEditor";
import {getPosition} from "@sensor-sim/shared/geoUtils";

export default function NoneEditor(props: Omit<SpecEditorProps<never>, "spec">) {

  async function initSpecWithType(type: SpecType | null) {

    const initSpec = (type: SpecType): Spec => {
      switch (type) {
        case "fixed":
          return {
            type,
            position: props.map.getCenter().toArray()
          }
        case "path":

          const wp1 = props.map.getCenter().toArray()
          // ap2 exactly 100m east of wp1
          const wp2 = getPosition(wp1, 100, 90)

          return {
            type,
            waypoints: [wp1, wp2],
            speed: 10,
            editMode: "linestring",
            playMode: "loop"
          }
        case "orbit":
          return {
            type,
            center: props.map.getCenter().toArray(),
            radius: 100,
            startAngle: 0,
            speed: 10,
          }
      }
    }

    updateConfig(props.configId, {spec: type && initSpec(type)})

  }

  return (
    <>
      <div>Select a Type</div>
      <div class="flex">
        <button class="btn" onClick={() => initSpecWithType("fixed")}>
          <TbOutlineMapPin/> Fixed
        </button>
        <button class="btn" onClick={() => initSpecWithType("path")}>
          <TbOutlinePolygon/> Path
        </button>
        <button class="btn" onClick={() => initSpecWithType("orbit")}>
          <TbOutlineCircle/> Orbit
        </button>
      </div>
    </>
  )
}
