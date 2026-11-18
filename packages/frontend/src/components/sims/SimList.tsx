import SimDetails from "./SimDetails";
import {useAuth} from "../../auth";
import {For, Match, Show, Switch} from "solid-js";
import SimForm from "./SimForm";
import {SimConfig} from "@sensor-sim/shared";
import {useNavigate} from "@solidjs/router";
import {TbOutlineCircle, TbOutlineMapPin, TbOutlinePolygon, TbOutlineQuestionMark} from "solid-icons/tb";

export default function SimList(props: { simConfigs: SimConfig[], simConfig: SimConfig | undefined }) {

  const {user} = useAuth()
  const navigate = useNavigate()

  function handleSelect(id: number) {
    navigate(props.simConfig?.id === id ? `/sims` : `/sims/${id}`)
  }

  return (
    <>
      <Show when={user()}>
        <div class="flex h-full min-h-0">
          <div class="w-lg min-h-0 overflow-y-scroll">

            <SimForm/>

            <ul class="list bg-base-100 gap-1 mb-4">

              <For each={props.simConfigs} keyed={(config) => config.id}>
                {(config) => (
                  <li
                    class={["cursor-pointer list-row items-center hover:bg-base-300", props.simConfig?.id === config().id ? "bg-base-300" : "bg-base-200"]}
                    onClick={() => handleSelect(config().id)}
                  >
                    <button
                      class={["btn btn-square text-2xl", props.simConfig?.id === config().id ? "btn-primary" : "btn-outline"]}
                    >
                      <Switch fallback={<TbOutlineQuestionMark/>}>
                        <Match when={config()?.spec?.type === 'path'}><TbOutlinePolygon/></Match>
                        <Match when={config()?.spec?.type === 'fixed'}><TbOutlineMapPin/></Match>
                        <Match when={config()?.spec?.type === 'orbit'}><TbOutlineCircle/></Match>
                      </Switch>
                    </button>

                    <div class="list-col-grow">
                      <div class="text-xl font-thin tabular-nums">{config().label}</div>
                    </div>
                  </li>
                )}
              </For>

            </ul>

          </div>
          <div class="flex-1 min-h-0">
            <SimDetails simConfig={props.simConfig}/>
          </div>
        </div>

      </Show>

    </>
  );

}