import {Show} from "solid-js";
import {
  TbFillPlayerPlay,
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
import {ConfigType, SimConfig} from "@sensor-sim/shared";
import {serverUrl} from "../../api";

export function SimDetails(props: { simConfig: SimConfig }) {

  const updateTypeAction = useAction(updateType)
  const deleteSimAction = useAction(deleteSimConfig)
  const startSimAction = useAction(startSim)
  const stopSimAction = useAction(stopSim)
  const updateSpeedAction = useAction(updateSpeed)
  const shareAction = useAction(share)
  const unShareAction = useAction(unShare)

  function handleToggleShare() {
    if (props.simConfig.shareToken) {
      unShareAction(props.simConfig.id)
    } else {
      shareAction(props.simConfig.id)
    }
  }

  function handleTogglePlay() {
    if (props.simConfig.playing) {
      stopSimAction(props.simConfig.id)
    } else {
      startSimAction(props.simConfig.id)
    }
  }

  function handleTypeChange(event: Event) {
    const target = event.target as HTMLSelectElement
    updateTypeAction(props.simConfig.id, target.value as ConfigType)
  }

  return (
    <>
      <Show fallback={<div>Connecting...</div>} when={props.simConfig}>
        {(config) =>
          <>

            <div class="card bg-base-300 w-full shadow-sm mb-2">
              <div class="card-body p-4">

                <div class="flex items-center gap-2">
                  <span>{config().label}</span>
                  <button class="btn btn-sm" onClick={handleTogglePlay}>
                    <Show when={config().playing}><TbFillPlayerStop/> Stop</Show>
                    <Show when={!config().playing}><TbFillPlayerPlay/> Play</Show>
                  </button>
                  <select class="select select-sm w-fit" onChange={handleTypeChange}>
                    <option value={"follow"} selected={config().type === "follow"}>Follow</option>
                    <option value={"circle"} selected={config().type === "circle"}>Circle</option>
                  </select>
                  <div class={"flex-1"}/>
                  <button class="btn btn-sm" onClick={() => deleteSimAction(config().id)}>
                    <TbFillTrash/>
                  </button>
                </div>

                <div class={"divider my-0"}/>

                <div class="flex gap-2 items-center">
                  <TbOutlineWorldLatitude/>{config().targetLatitude.toFixed(5)}
                  <TbOutlineWorldLongitude/>{config().targetLongitude.toFixed(5)}
                  <TbOutlineRulerMeasure/> {config().initialDistance.toFixed(2)}m
                  <TbOutlineAngle/> {config().initialAzimuth.toFixed(2)}°
                </div>
                <div class="flex gap-2 items-center">
                  <BsSpeedometer/><span>{config().speed}m/s</span>
                  <input type="range" min="0" max="40" value={config().speed}
                         onChange={(e) => updateSpeedAction(config().id, +e.currentTarget.value)}
                         class="range range-xs w-full"/>
                </div>

                <div class={"divider my-0"}/>

                <div class="flex gap-1 items-center">
                  <button class="btn btn-sm" onClick={handleToggleShare}>
                    <Show when={config().shareToken}><TbOutlineShareOff/> Unshare</Show>
                    <Show when={!config().shareToken}><TbOutlineShare/> Share</Show>
                  </button>
                  <Show when={config().shareToken}>
                    <div class="truncate flex-1" id="shareUrl">{serverUrl + "/s/" + config().shareToken}</div>
                    <button class="btn btn-sm" onClick={() => {
                      // copy to clipboard
                      navigator.clipboard.writeText(serverUrl + "/s/" + config().shareToken);
                    }}>
                      <TbOutlineClipboard/>
                    </button>
                  </Show>
                </div>

              </div>
            </div>

          </>
        }
      </Show>
    </>
  )
}