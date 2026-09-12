import {SimList} from "./SimList";
import SimMap from "./SimMap";

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