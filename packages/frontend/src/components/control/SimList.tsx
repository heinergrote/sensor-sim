import {createMemo, For} from "solid-js";

import {SimDetails} from "./SimDetails";
import {addSimConfig, fetchSimConfigs} from "../../service/configs.service";

export function SimList() {

  const simConfigs = createMemo(() => fetchSimConfigs());

  return (
    <>
      <form action={addSimConfig} method="post">
        <fieldset class="fieldset bg-base-200 border-base-300 rounded-box border p-2 mb-2 w-full">
          <div class="flex gap-1">
            <div class="flex-1">
              <label class="label">Label</label>
              <input name="label" type="text" class="input" placeholder="Label"/>
            </div>
            <div class="flex-1">
              <label class="label">Type</label>
              <select name="type" class="select select-bordered w-full max-w-xs">
                <option value="follow">Follow</option>
                <option value="circle">Circle</option>
              </select>
            </div>
            <div>
              <button class="btn btn-neutral mt-4" type="submit">+</button>
            </div>
          </div>
        </fieldset>
      </form>

      <For each={simConfigs()} keyed={(config) => config.id}>
        {(config, key) => (

          <div class="card w-full bg-base-200 card-md shadow-sm mb-2">
            <div class="card-body">
              <h2 class="card-title">{config().id} - {config().label}</h2>
              <div class="flex items-center"></div>
              <div class={"flex-1"}>
                <SimDetails simConfig={config()}/>
              </div>
            </div>
          </div>

        )}
      </For>

    </>
  );
}