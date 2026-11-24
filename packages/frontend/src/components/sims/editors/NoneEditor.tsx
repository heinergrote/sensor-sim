import {Spec, SpecType} from "@sensor-sim/shared";
import {TbOutlineCircle, TbOutlineMapPin, TbOutlinePolygon} from "solid-icons/tb";
import {updateConfig} from "../../../service/configs.service";
import type {SpecEditorProps} from "./SpecEditor";

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
          return {
            type,
            waypoints: [props.map.getCenter().toArray()], // start with a one point path
            speed: 10,
            editMode: "point",
            playMode: "loop"
          }
        case "orbit":
          return {
            type,
            center: props.map.getCenter().toArray(),
            radius: 20,
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
