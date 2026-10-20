import SimMap from "./SimMap";
import {useAuth} from "../../auth";
import {For, Show} from "solid-js";
import SimForm from "./SimForm";
import {SimCard} from "./SimCard";
import {SimConfig} from "@sensor-sim/shared";

export default function SimList(props: { simConfigs: SimConfig[], simConfig: SimConfig | undefined }) {

  const {user} = useAuth()

  return (
    <>
      <Show when={user()}>
        <div class="flex h-full min-h-0">
          <div class="w-lg min-h-0 overflow-y-scroll">

            <SimForm/>

            <For each={props.simConfigs} keyed={(config) => config.id}>
              {(config) => (
                <SimCard simConfig={config()}/>
              )}
            </For>

          </div>
          <div class="flex-1 min-h-0">
            <SimMap simConfig={props.simConfig}/>
          </div>
        </div>
      </Show>
    </>
  );

}