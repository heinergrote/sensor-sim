import SimMap from "./SimMap";
import {SimList} from "./SimList";
import {useAuth} from "../../auth";
import {Show} from "solid-js";

export default function SimControl() {

  const {user} = useAuth()

  return (
    <>
      <Show when={user()}>
        <div class="flex h-full min-h-0 gap-2">
          <div class="w-lg min-h-0 overflow-y-scroll">
            <SimList/>
          </div>
          <div class="flex-1 min-h-0">
            <SimMap/>
          </div>
        </div>
      </Show>
    </>
  );

}