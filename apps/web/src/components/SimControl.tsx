import {createSignal} from "solid-js";
import {SimList} from "~/components/SimList";
import SimMap from "~/components/SimMap";

export default function SimControl() {

  const [simId, setSimId] = createSignal<string | undefined>(undefined)

  return (
    <>

      <SimList onSelectSim={setSimId}/>
      <SimMap/>
    </>
  );

}