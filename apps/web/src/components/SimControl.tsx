import {createSignal} from "solid-js";
import {SimList} from "~/components/SimList";
import SimMap from "~/components/SimMap";

export default function SimControl() {

  const [simId, setSimId] = createSignal<string | undefined>(undefined)

  return (
    <>
      <div class="flex h-full">
        <div class="w-lg overflow-y-scroll">
          <SimList onSelectSim={setSimId}/>
        </div>
        <div class="flex-1">
          <SimMap/>
        </div>
      </div>
    </>
  );

}