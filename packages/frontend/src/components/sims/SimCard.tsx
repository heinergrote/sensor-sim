import {Match, Show, Switch} from "solid-js";
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
import {useAction, useMatch, useNavigate} from "@solidjs/router";
import {
  deleteSimConfig,
  share,
  startSim,
  stopSim,
  unShare,
  updateSimConfig,
  updateType
} from "../../service/configs.service";
import {SimConfig, SpecFixed, SpecOrbit, SpecPath, SpecType} from "@sensor-sim/shared";
import {serverUrl} from "../../api";
import {paths} from "../../router";

export function SimCard(props: { simConfig: SimConfig }) {

  const navigate = useNavigate()
  const selected = useMatch(() => paths.sims(props.simConfig.id));

  const updateTypeAction = useAction(updateType)
  const deleteSimAction = useAction(deleteSimConfig)
  const startSimAction = useAction(startSim)
  const stopSimAction = useAction(stopSim)
  const updateSimConfigAction = useAction(updateSimConfig)
  const shareAction = useAction(share)
  const unShareAction = useAction(unShare)

  const specPath = () => props.simConfig.spec?.type === "path" ? props.simConfig.spec as SpecPath : null
  const specOrbit = () => props.simConfig.spec?.type === "orbit" ? props.simConfig.spec as SpecOrbit : null
  const specFixed = () => props.simConfig.spec?.type === "fixed" ? props.simConfig.spec as SpecFixed : null

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
    if (target.value === "_none") {
      updateTypeAction(props.simConfig.id, null)
    } else {
      updateTypeAction(props.simConfig.id, target.value as SpecType)
    }
  }


  function handleSelect() {
    navigate(selected() ? `/sims` : `/sims/${props.simConfig.id}`)
  }

  return (
    <>
      <Show fallback={<div>Connecting...</div>} when={props.simConfig}>
        {(config) =>
          <>

            <div class={["card w-full shadow-sm mb-2", selected() ? "bg-base-300" : "bg-base-200"]}>
              <div class="card-body p-4">

                <div class="flex items-center gap-2">
                  <span>{config().label}</span>
                  <button class="btn btn-sm" onClick={handleTogglePlay}>
                    <Show when={config().playing}><TbFillPlayerStop/> Stop</Show>
                    <Show when={!config().playing}><TbFillPlayerPlay/> Play</Show>
                  </button>
                  <div class={"flex-1"}/>
                  <button class="btn btn-sm" onClick={() => deleteSimAction(config().id)}>
                    <TbFillTrash/>
                  </button>
                </div>

                <div class={"divider my-0"}/>

                <div class="flex flex-row gap-2">

                  <select class="select select-sm w-fit" onChange={handleTypeChange}>
                    <option value={"_none"} selected={!config().spec}>None</option>
                    <option value={"fixed"} selected={config().spec?.type === "fixed"}>Fixed</option>
                    <option value={"path"} selected={config().spec?.type === "path"}>Path</option>
                    <option value={"orbit"} selected={config().spec?.type === "orbit"}>Orbit</option>
                  </select>

                  <div class={"divider divider-horizontal mx-0"}/>

                  <div class="flex-1">

                    <Switch fallback={<>Select Simulation Type</>}>
                      <Match when={specFixed()}>
                        {(spec) =>
                          <>
                            <div class="flex gap-2 items-center">
                              <TbOutlineWorldLatitude/>{spec().position[1].toFixed(5)},
                              <TbOutlineWorldLongitude/>{spec().position[0].toFixed(5)}
                            </div>
                          </>
                        }
                      </Match>
                      <Match when={specPath()}>
                        {(spec) =>
                          <>
                            <div class="flex gap-2 items-center">
                              From: <TbOutlineWorldLongitude/>{spec().start[0].toFixed(5)},
                              <TbOutlineWorldLatitude/>{spec().start[1].toFixed(5)}
                            </div>
                            <div class="flex gap-2 items-center">
                              To: <TbOutlineWorldLongitude/>{spec().target[0].toFixed(5)},
                              <TbOutlineWorldLatitude/>{spec().target[1].toFixed(5)}
                            </div>
                            <div class="flex gap-2 items-center">
                              <BsSpeedometer/><span>{spec().speed}m/s</span>
                              <input type="range" min="0" max="40" value={spec().speed}
                                     onChange={(e) => updateSimConfigAction(config().id, {
                                       spec: {
                                         ...spec(),
                                         speed: +e.currentTarget.value
                                       }
                                     })}
                                     class="range range-xs w-full"
                              />
                            </div>
                          </>
                        }
                      </Match>
                      <Match when={specOrbit()}>
                        {(spec) =>
                          <>
                            <div class="flex gap-2 items-center">
                              <TbOutlineWorldLongitude/>{spec().center[0].toFixed(5)},
                              <TbOutlineWorldLatitude/>{spec().center[1].toFixed(5)}
                            </div>
                            <div class="flex gap-2 items-center">
                              <TbOutlineRulerMeasure/> {spec().radius.toFixed(2)}m
                              <TbOutlineAngle/> {spec().startAngle.toFixed(2)}°
                            </div>
                            <div class="flex gap-2 items-center">
                              <BsSpeedometer/><span>{spec().speed}m/s</span>
                              <input type="range" min="0" max="40" value={spec().speed}
                                     onChange={(e) => updateSimConfigAction(config().id, {
                                       spec: {
                                         ...spec(),
                                         speed: +e.currentTarget.value
                                       }
                                     })}
                                     class="range range-xs w-full"
                              />
                            </div>
                          </>
                        }
                      </Match>
                    </Switch>
                  </div>
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
                <div class="card-actions justify-end">
                  <button class="btn btn-primary" onClick={handleSelect}>Select</button>
                </div>
              </div>
            </div>

          </>
        }
      </Show>
    </>
  )
}