import SimMap from "./SimMap";
import {SimList} from "./SimList";

export default function SimControl() {

  return (
    <>
      <div class="flex h-full min-h-0">
        <div class="w-lg min-h-0 overflow-y-scroll">
          <SimList/>
        </div>
        <div class="flex-1 min-h-0">
          <SimMap/>
        </div>
      </div>
    </>
  );

}