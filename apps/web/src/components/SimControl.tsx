import {createSignal, Show} from "solid-js";
import {SimList} from "~/components/SimList";
import SimMap from "~/components/SimMap";

export default function SimControl() {

  const [simId, setSimId] = createSignal<string | undefined>(undefined)

  return (
    <>


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