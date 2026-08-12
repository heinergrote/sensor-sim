import {createEffect, createResource, createSignal, For, Show} from "solid-js";
import {SimDetails} from "~/components/SimDetails";
import {trpcService} from "~/trcpService";

export function SimList(props: {
  onSelectSim: (id: string | undefined) => void;
}) {

  const [sims, {refetch}] = createResource(
    () => ({client: trpcService.client()}), // wrap source, to always be truthy -> always refetch
    async ({client}) => {
      if (!client) return [];
      return await client.listSims.query();
    }
  );

  const [newSimId, setNewSimId] = createSignal<string>("")
  const [newType, setNewType] = createSignal<"follow" | "circle">("circle")


  const handleCreateSim = (e: SubmitEvent) => {
    e.preventDefault();
    const client = trpcService.client();
    if (!client) return;
    client.createSim.mutate({id: newSimId(), type: newType()}).then(() => {
      setNewSimId("")
      refetch()
    });
  }

  const handleDeleteSim = (id: string) => {
    const client = trpcService.client();
    if (!client) return;
    client.deleteSim.mutate({id}).then(() => {
      props.onSelectSim(undefined)
      refetch()
    });
  }


  createEffect(() => {
    if (sims.state === "ready") {
      console.log("sims", sims())
      // get the highest sim id, and set the next id in the form
      const highestSimId = sims().reduce((acc, sim) => {
        const simId = parseInt(sim.id.split("-")[1]);
        return simId > acc ? simId : acc;
      }, 0);
      setNewSimId(`sim-${highestSimId + 1}`)
    }
  })

  return (
    <div class="p-2">

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

      <Show when={!sims.error}
            fallback={<p style={{color: 'red'}}>Error loading simulations.</p>}>

        <Show when={!sims.loading && sims()}
              fallback={<p>Loading simulations...</p>}>

          <ul class="list bg-base-100 rounded-box shadow-md">
            <For each={sims()}>
              {(sim) => (
                <li class="list-row">
                  <div>
                    {sim.id}
                  </div>
                  <div>
                    <SimDetails id={sim.id}/>
                  </div>
                  <div class="flex gap-2">
                    <button class="btn btn-sm" onClick={() => handleDeleteSim(sim.id)}>
                      Delete
                    </button>
                    <button class="btn btn-sm" onClick={() => props.onSelectSim(sim.id)}>
                      Select
                    </button>
                  </div>
                </li>
              )}
            </For>
          </ul>

        </Show>

      </Show>
    </div>
  );
}