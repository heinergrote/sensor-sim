import {createSignal, Show} from "solid-js";
import {SimList} from "~/components/SimList";
import SimMap from "~/components/SimMap";
import {createSim} from "~/trpcClient";

export default function SimControl() {

  const [simId, setSimId] = createSignal<string | undefined>(undefined)
  const [newSimId, setNewSimId] = createSignal<string>("default")

  return (
    <>
      <form onSubmit={(e) => {
        e.preventDefault();
        createSim(newSimId()).then(() => setSimId(newSimId()));
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

      <SimList
        onSelectSim={setSimId}
      />
      <Show when={simId()}>
        {(id) =>
          <SimMap simId={id()}/>
        }
      </Show>
    </>
  );

}