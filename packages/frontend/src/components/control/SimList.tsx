import {createEffect, createMemo, createSignal, For} from "solid-js";
import {SimDetails} from "./SimDetails";
import {addSim, fetchSimulations} from "../../service/simulations.service";
import {Simulation} from "@sensor-sim/server";

export function SimList() {

  const simulations = createMemo(() => fetchSimulations());

  const [newSimId, setNewSimId] = createSignal<string>("")

  const nextSimId = (sims: Simulation[]) => {
    const highest = sims.reduce((acc, sim) => {
      const simId = parseInt(sim.config.id.split("-")[1]);
      return simId > acc ? simId : acc;
    }, 0);
    return highest + 1;
  }

  createEffect(
    () => nextSimId(simulations()),
    (id) => {
      setNewSimId(`sim-${id}`)
    })

  return (
    <>
      <form action={addSim} method="post">
        <fieldset class="fieldset bg-base-200 border-base-300 rounded-box border p-2 mb-2 w-full">
          <div class="flex gap-1">
            <div class="flex-1">
              <label class="label">ID</label>
              <input name="simId" type="text" class="input" placeholder="SimId"
                     value={newSimId()}
                     onChange={(e) => setNewSimId(e.currentTarget.value)}
              />
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

      <For each={simulations()} keyed={(sim) => sim.config.id}>
        {(sim, key) => (

          <div class="card w-full bg-base-200 card-md shadow-sm mb-2">
            <div class="card-body">
              <h2 class="card-title">{sim().config.id}</h2>
              <div class="flex items-center"></div>
              <div class={"flex-1"}>
                <SimDetails id={sim().config.id}/>
              </div>
            </div>
          </div>

        )}
      </For>

    </>
  );
}