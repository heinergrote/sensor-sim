import {addSimConfig} from "../../service/configs.service";

export default function SimForm() {

  return <form action={addSimConfig} method="post">
    <fieldset class="fieldset bg-base-300 rounded-box shadow-sm p-2 mb-2 w-full">
      <div class="flex gap-1">
        <div class="flex-1">
          <input name="label" type="text" class="input w-full" placeholder="Label"/>
        </div>
        <button class="btn btn-neutral" type="submit">+</button>
      </div>
    </fieldset>
  </form>

}