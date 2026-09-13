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
import {honoClient, simulations} from "../simulationsService";

export function SimDetails(props: { id: string }) {

  const sim = createMemo(() => {
    return simulations.find(
      (sim) => sim.config.id === props.id
    )
  })

  const handleStartSim = (id: string) => {
    honoClient.api.sims.start.$post({
      json: {id}
    })
  }

  const handleStopSim = (id: string) => {
    honoClient.api.sims.stop.$post({
      json: {id}
    })
  }

  const handleDeleteSim = (id: string) => {
    honoClient.api.sims.delete.$post({
      json: {id}
    })
  }

  return (
    <div>
      <Show fallback={<div>Connecting...</div>} when={sim()}>
        {(sim) =>
          <>
            <div class={"flex gap-1"}>

              <div class={"flex-1"}>
                <div>Type: {sim().config.type}</div>
                <div class="flex gap-1 items-center">
                  <TbOutlineWorldLatitude/>{sim().config.target.latitude.toFixed(5)}
                  <TbOutlineWorldLongitude/>{sim().config.target.longitude.toFixed(5)}
                </div>
                <div class="flex gap-1 items-center">
                  <TbOutlineRulerMeasure/> {sim().config.initialDistance.toFixed(2)}m
                  <TbOutlineAngle/> {sim().config.initialAzimuth.toFixed(2)}°
                  <BsSpeedometer/> {sim().config.speed}m/s
                </div>
              </div>

              <div>
                <div class="join">
                  {sim().state ?
                    <>
                      <button class="btn btn-sm join-item" onClick={() => handleStartSim(sim().config.id)}>
                        <TbFillPlayerSkipBack size={24}/>
                      </button>
                      <button class="btn btn-sm join-item" onClick={() => handleStopSim(sim().config.id)}>
                        <TbFillPlayerStop size={24}/>
                      </button>
                    </>
                    :
                    <>
                      <button class="btn btn-sm join-item" onClick={() => handleStartSim(sim().config.id)}>
                        <TbFillPlayerPlay size={24}/>
                      </button>
                    </>
                  }
                  <button class="btn btn-sm join-item" onClick={() => handleDeleteSim(sim().config.id)}>
                    <TbFillTrash size={20}/>
                  </button>
                </div>

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
    </div>
  )
}