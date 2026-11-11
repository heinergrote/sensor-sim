import {formAction} from "@solidjs/router";
import {useSimConfigsApi} from "../../service/configs.service";

export default function SimForm() {

  const api = useSimConfigsApi()

  const addSimConfigAction = formAction(async (form: FormData) => {
      await api.add(form.get("label") as string)
    },
    "addSimConfigAction")

  return (
    <>
      <form action={addSimConfigAction} method="post">
        <fieldset class="fieldset bg-base-300 rounded-box shadow-sm p-2 mb-2 w-full">
          <div class="flex gap-1">
            <div class="flex-1">
              <input name="label" type="text" class="input w-full" placeholder="Label"/>
            </div>
            <button class="btn btn-neutral" type="submit">+</button>
          </div>
        </fieldset>
      </form>
    </>
  )
}