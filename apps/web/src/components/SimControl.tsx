import {SimList} from "~/components/SimList";
import SimMap from "~/components/SimMap";

export default function SimControl() {

  return (
    <>
      <div class="flex h-full">
        <div class="w-lg overflow-y-scroll">
          <SimList/>
        </div>
        <div class="flex-1">
          <SimMap/>
        </div>
      </div>
    </>
  );

}