import {createResource, createSignal, For, Show} from "solid-js";
import {useTrpc} from "~/trpcClient";
import {SimDetails} from "~/components/SimDetails";

export function SimList(props: {
  onSelectSim: (id: string | undefined) => void;
}) {
  const client = useTrpc();

  const [sims, {refetch}] = createResource(() => {
    console.log("SimList: fetching")
    return client.listSims.query()
  });

  const [newSimId, setNewSimId] = createSignal<string>("default")

  return (
    <div style={{padding: '1rem'}}>

      <form onSubmit={(e) => {
        e.preventDefault();
        client.createSim.mutate({id: newSimId()}).then(() => {
          refetch()
        });
      }}>
        <fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4">
          <legend class="fieldset-legend">New Sim</legend>
          <label class="label">ID</label>
          <input name="simId" type="text" class="input" placeholder="SimId"
                 value={newSimId()}
                 onChange={(e) => setNewSimId(e.currentTarget.value)}
          />
          <button class="btn btn-neutral mt-4" type="submit">Create</button>
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
                    <button class="btn btn-sm"
                            onClick={() => client.deleteSim.mutate({id: sim.id}).then(
                              () => {
                                props.onSelectSim(undefined)
                                refetch()
                              }
                            )}>
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