import {createResource, For, Show} from "solid-js";
import {fetchSims} from "~/trpcClient";
import {SimDetails} from "~/components/SimDetails";

export function SimList(props: {
  onSelectSim: (id: string) => void;
}) {
  const [sims, {refetch}] = createResource(fetchSims);

  return (
    <div style={{padding: '1rem'}}>

      <button
        class="btn"
        onClick={() => refetch()} disabled={sims.loading}>
        {sims.loading ? 'Refreshing...' : 'Refresh List'}
      </button>

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
                  <div>
                    <button
                      class="btn btn-sm"
                      onClick={() => props.onSelectSim(sim.id)}>
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