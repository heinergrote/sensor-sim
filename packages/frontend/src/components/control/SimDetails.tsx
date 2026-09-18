import {createSignal, onSettled, Show} from "solid-js";
import {
  TbFillPlayerPlay,
  TbFillPlayerSkipBack,
  TbFillPlayerStop,
  TbFillTrash,
  TbOutlineAngle,
  TbOutlineRulerMeasure,
  TbOutlineWorldLatitude,
  TbOutlineWorldLongitude
} from "solid-icons/tb";
import {BsSpeedometer} from "solid-icons/bs";
import {deleteSim, share, startSim, stopSim, updateSpeed, updateType} from "../../service/simulations.service";
import {useAction} from "@solidjs/router";
import {Simulation} from "@sensor-sim/server";
import {addSimulationListener} from "../../service/simulation.service";

export function SimDetails(props: { id: string }) {

  const [sim, setSim] = createSignal<Simulation | null>(null)

  const updateTypeAction = useAction(updateType)
  const deleteSimAction = useAction(deleteSim)
  const startSimAction = useAction(startSim)
  const stopSimAction = useAction(stopSim)
  const updateSpeedAction = useAction(updateSpeed)
  const shareAction = useAction(share)

  onSettled(() => {
    // subscribe to sim updates and update local signal
    return addSimulationListener(props.id, setSim)
  })

  return (
    <>
      <Show fallback={<div>Connecting...</div>} when={sim()}>
        {(sim) =>
          <>

            <div class={"flex flex-col w-full"}>
              <div class="flex gap-2 items-center">
                <div class="join">
                  <input
                    class={`join-item btn ${sim().config.type === "follow" ? "btn-primary" : ""} btn-xs`}
                    type="radio" name="options" value={"follow"}
                    onClick={() => updateTypeAction(sim().config.id, "follow")}
                    checked={sim().config.type === "follow"} aria-label="Follow"/>
                  <input
                    class={`join-item btn ${sim().config.type === "circle" ? "btn-primary" : ""} btn-xs`}
                    type="radio" name="options" value={"circle"}
                    onClick={() => updateTypeAction(sim().config.id, "circle")}
                    checked={sim().config.type === "circle"} aria-label="Circle"/>
                </div>
                <div class="join">
                  {sim().state ?
                    <>
                      <button class="btn btn-xs join-item" onClick={() => startSimAction(sim().config.id)}>
                        <TbFillPlayerSkipBack/>
                      </button>
                      <button class="btn btn-xs join-item" onClick={() => stopSimAction(sim().config.id)}>
                        <TbFillPlayerStop/>
                      </button>
                    </>
                    :
                    <>
                      <button class="btn btn-xs join-item" onClick={() => startSimAction(sim().config.id)}>
                        <TbFillPlayerPlay/>
                      </button>
                    </>
                  }
                  <button class="btn btn-xs join-item" onClick={() => deleteSimAction(sim().config.id)}>
                    <TbFillTrash/>
                  </button>
                </div>
              </div>

              <div class="flex gap-1 items-center">
                <TbOutlineWorldLatitude/>{sim().config.targetLatitude.toFixed(5)}
                <TbOutlineWorldLongitude/>{sim().config.targetLongitude.toFixed(5)}
              </div>
              <div class="flex gap-1 items-center">
                <TbOutlineRulerMeasure/> {sim().config.initialDistance.toFixed(2)}m
                <TbOutlineAngle/> {sim().config.initialAzimuth.toFixed(2)}°
              </div>
              <div class="flex gap-1 items-center">
                <div class="flex gap-1 items-center"><BsSpeedometer/> {sim().config.speed}m/s</div>
                <div><input type="range" min="0" max="40" value={sim().config.speed}
                            onChange={(e) => updateSpeedAction(sim().config.id, +e.currentTarget.value)}
                            class="range range-xs w-60"/></div>
              </div>

            </div>

            <button class="btn" onClick={() => shareAction(sim().config.id)}>
              Share
            </button>


            <Show when={sim().state}>
              {(state) => <>
                <div class="divider m-0"></div>
                <div class="flex gap-1 items-center">
                  <TbOutlineWorldLatitude/>{state().current.latitude.toFixed(5)}
                  <TbOutlineWorldLongitude/>{state().current.longitude.toFixed(5)}
                </div>
                <div class="flex gap-1 items-center">
                  <TbOutlineRulerMeasure/> {state().distance.toFixed(2)}m
                  <TbOutlineAngle/> {state().azimuth.toFixed(2)}°
                </div>

              </>}
            </Show>

          </>
        }
      </Show>
    </>
  )
}