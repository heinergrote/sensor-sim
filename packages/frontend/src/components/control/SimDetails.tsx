import {Show} from "solid-js";
import {
  TbFillPlayerPlay,
  TbFillPlayerSkipBack,
  TbFillPlayerStop,
  TbFillTrash,
  TbOutlineAngle,
  TbOutlineClipboard,
  TbOutlineRulerMeasure,
  TbOutlineShare,
  TbOutlineShareOff,
  TbOutlineWorldLatitude,
  TbOutlineWorldLongitude
} from "solid-icons/tb";
import {BsSpeedometer} from "solid-icons/bs";
import {useAction} from "@solidjs/router";
import {
  deleteSimConfig,
  share,
  startSim,
  stopSim,
  unShare,
  updateSpeed,
  updateType
} from "../../service/configs.service";
import {SimConfigDto} from "@sensor-sim/server";

export function SimDetails(props: { simConfig: SimConfigDto }) {

  const updateTypeAction = useAction(updateType)
  const deleteSimAction = useAction(deleteSimConfig)
  const startSimAction = useAction(startSim)
  const stopSimAction = useAction(stopSim)
  const updateSpeedAction = useAction(updateSpeed)
  const shareAction = useAction(share)
  const unShareAction = useAction(unShare)

  return (
    <>
      <Show fallback={<div>Connecting...</div>} when={props.simConfig}>
        {(config) =>
          <>

            <div class={"flex flex-col gap-1 w-full"}>


              <div class="flex gap-2 items-center">
                <div class="join">
                  <input
                    class={`join-item btn ${config().type === "follow" ? "btn-primary" : ""} btn-sm`}
                    type="radio" name="options" value={"follow"}
                    onClick={() => updateTypeAction(config().id, "follow")}
                    checked={config().type === "follow"} aria-label="Follow"/>
                  <input
                    class={`join-item btn ${config().type === "circle" ? "btn-primary" : ""} btn-sm`}
                    type="radio" name="options" value={"circle"}
                    onClick={() => updateTypeAction(config().id, "circle")}
                    checked={config().type === "circle"} aria-label="Circle"/>
                </div>
                <div class="join">
                  {config().playing ?
                    <>
                      <button class="btn btn-sm join-item" onClick={() => startSimAction(config().id)}>
                        <TbFillPlayerSkipBack/>
                      </button>
                      <button class="btn btn-sm join-item" onClick={() => stopSimAction(config().id)}>
                        <TbFillPlayerStop/>
                      </button>
                    </>
                    :
                    <>
                      <button class="btn btn-sm join-item" onClick={() => startSimAction(config().id)}>
                        <TbFillPlayerPlay/>
                      </button>
                    </>
                  }
                  <button class="btn btn-sm join-item" onClick={() => deleteSimAction(config().id)}>
                    <TbFillTrash/>
                  </button>
                </div>
              </div>
              <div class="flex gap-2 items-center">
                <TbOutlineWorldLatitude/>{config().targetLatitude.toFixed(5)}
                <TbOutlineWorldLongitude/>{config().targetLongitude.toFixed(5)}
                <TbOutlineRulerMeasure/> {config().initialDistance.toFixed(2)}m
                <TbOutlineAngle/> {config().initialAzimuth.toFixed(2)}°
              </div>
              <div class="flex gap-1 items-center">
                <div class="flex gap-1 items-center"><BsSpeedometer/> {config().speed}m/s</div>
                <div><input type="range" min="0" max="40" value={config().speed}
                            onChange={(e) => updateSpeedAction(config().id, +e.currentTarget.value)}
                            class="range range-xs w-60"/></div>
              </div>

              <div class="flex gap-1 items-center">
                <button class="btn btn-sm" onClick={() => shareAction(config().id)}>
                  <TbOutlineShare/> Share
                </button>
                <Show when={config().shareToken}>
                  <button class="btn btn-sm" onClick={() => unShareAction(config().id)}>
                    <TbOutlineShareOff/>
                  </button>
                  <div class="truncate" id="shareToken">{config().shareToken}</div>
                  <button class="btn btn-sm" onClick={() => {
                    // copy to clipboard
                    navigator.clipboard.writeText(config().shareToken);
                  }}>
                    <TbOutlineClipboard/>
                  </button>
                </Show>
              </div>

            </div>


          </>
        }
      </Show>
    </>
  )
}