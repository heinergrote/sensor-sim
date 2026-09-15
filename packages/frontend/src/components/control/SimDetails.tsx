import {createMemo, Show} from "solid-js";
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
import {deleteSim, simulations, startSim, stopSim, updateSpeed, updateType} from "../../service/simulations.service";

export function SimDetails(props: { id: string }) {

  const sim = createMemo(() => {
    return simulations.find(
      (sim) => sim.config.id === props.id
    )
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
                    onClick={() => updateType(sim().config.id, "follow")}
                    checked={sim().config.type === "follow"} aria-label="Follow"/>
                  <input
                    class={`join-item btn ${sim().config.type === "circle" ? "btn-primary" : ""} btn-xs`}
                    type="radio" name="options" value={"circle"}
                    onClick={() => updateType(sim().config.id, "circle")}
                    checked={sim().config.type === "circle"} aria-label="Circle"/>
                </div>
                <div class="join">
                  {sim().state ?
                    <>
                      <button class="btn btn-xs join-item" onClick={() => startSim(sim().config.id)}>
                        <TbFillPlayerSkipBack/>
                      </button>
                      <button class="btn btn-xs join-item" onClick={() => stopSim(sim().config.id)}>
                        <TbFillPlayerStop/>
                      </button>
                    </>
                    :
                    <>
                      <button class="btn btn-xs join-item" onClick={() => startSim(sim().config.id)}>
                        <TbFillPlayerPlay/>
                      </button>
                    </>
                  }
                  <button class="btn btn-xs join-item" onClick={() => deleteSim(sim().config.id)}>
                    <TbFillTrash/>
                  </button>
                </div>
              </div>

              <div class="flex gap-1 items-center">
                <TbOutlineWorldLatitude/>{sim().config.target.latitude.toFixed(5)}
                <TbOutlineWorldLongitude/>{sim().config.target.longitude.toFixed(5)}
              </div>
              <div class="flex gap-1 items-center">
                <TbOutlineRulerMeasure/> {sim().config.initialDistance.toFixed(2)}m
                <TbOutlineAngle/> {sim().config.initialAzimuth.toFixed(2)}°
              </div>
              <div class="flex gap-1 items-center">
                <div class="flex gap-1 items-center"><BsSpeedometer/> {sim().config.speed}m/s</div>
                <div><input type="range" min="0" max="40" value={sim().config.speed}
                            onChange={(e) => updateSpeed(sim().config.id, +e.currentTarget.value)}
                            class="range range-xs w-60"/></div>
              </div>

            </div>


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