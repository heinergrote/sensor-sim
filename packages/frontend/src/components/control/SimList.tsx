import {createEffect, createSignal, For} from "solid-js";
import {SimDetails} from "./SimDetails";
import {createSim, simulations} from "../../service/simulations.service";
import {Simulation} from "@sensor-sim/server";

export function SimList() {

  const [newSimId, setNewSimId] = createSignal<string>("")
  const [newType, setNewType] = createSignal<"follow" | "circle">("follow")

  const nextSimId = (sims: Simulation[]) => {
    const highest = sims.reduce((acc, sim) => {
      const simId = parseInt(sim.config.id.split("-")[1]);
      return simId > acc ? simId : acc;
    }, 0);
    return highest + 1;
  }

  createEffect(
    () => nextSimId(simulations),
    (id) => {
      setNewSimId(`sim-${id}`)
    })

  const handleCreateSim = async (e: SubmitEvent) => {
    e.preventDefault();
    const res = await createSim(newSimId(), newType())
  }

  return (
    <>
      <form onSubmit={handleCreateSim}>
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
              <select name="type" class="select select-bordered w-full max-w-xs"
                      onChange={(e) => setNewType(e.currentTarget.value as "follow" | "circle")}
              >
                <option value="follow" selected={newType() === "follow"}>Follow</option>
                <option value="circle" selected={newType() === "circle"}>Circle</option>
              </select>
            </div>
            <div>
              <button class="btn btn-neutral mt-4" type="submit">+</button>
            </div>
          </div>
        </fieldset>
      </form>


      <ul class="list bg-base-100 rounded-box bg-base-200 border-base-300 border">
        <For each={simulations}>
          {(sim) => (
            <li class="list-row">
              <div>
                {sim.config.id}
              </div>
              <div>
                <SimDetails id={sim.config.id}/>
              </div>
            </li>
          )}
        </For>
      </ul>


    </>
  );
}