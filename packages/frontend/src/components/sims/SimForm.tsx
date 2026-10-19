import {addSimConfig} from "../../service/configs.service";

export default function SimForm() {

  return <form action={addSimConfig} method="post">
    <fieldset class="fieldset bg-base-300 rounded-box shadow-sm p-2 mb-2 w-full">
      <div class="flex gap-1">
        <div class="flex-1">
          <label class="label">Label</label>
          <input name="label" type="text" class="input" placeholder="Label"/>
        </div>
        <div class="flex-1">
          <label class="label">Type</label>
          <select name="type" class="select select-bordered w-full max-w-xs">
            <option value="follow">Follow</option>
            <option value="circle">Circle</option>
          </select>
        </div>
        <div>
          <button class="btn btn-neutral mt-4" type="submit">+</button>
        </div>
      </div>
    </fieldset>
  </form>
  
}