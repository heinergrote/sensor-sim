import SimDetails from "./SimDetails";
import {useAuth} from "../../auth";
import {For, Show} from "solid-js";
import SimForm from "./SimForm";
import {SimConfig} from "@sensor-sim/shared";
import {useNavigate} from "@solidjs/router";

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
                    class={["cursor-pointer list-row hover:bg-base-300", props.simConfig?.id === config().id ? "bg-base-300" : "bg-base-200"]}
                    onClick={() => handleSelect(config().id)}
                  >
                    <div class="text-2xl font-thin tabular-nums">
                      <button
                        class={["btn text-2xl font-thin tabular-nums", props.simConfig?.id === config().id ? "btn-primary" : "btn-outline"]}
                        onClick={() => handleSelect(config().id)}
                      >
                        {config().id}
                      </button>
                    </div>

                    <div class="list-col-grow">
                      <div>{config().label}</div>
                      <div class="text-xs opacity-60">Type: {config().spec?.type ?? 'none'}</div>
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