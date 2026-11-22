import {useNavigate} from "@solidjs/router";
import {TimeoutError, until} from "solid-js";
import {addConfig, configs} from "../../service/configs.service";
import {Router} from "../../router";

export default function SimForm() {
  const navigate = useNavigate()

  async function handleSubmit(e: SubmitEvent & { currentTarget: HTMLFormElement }) {
    e.preventDefault()
    const form = e.currentTarget
    const label = new FormData(form).get("label") as string
    form.reset()
    const created = await addConfig(label)
    // navigate only once the list contains the new id, otherwise Sims' "missing" redirect bounces back to /sims
    try {
      await until(() => configs.some(config => config.id === created.id), {timeout: 5_000})
    } catch (error) {
      if (error instanceof TimeoutError) return console.warn(`sim ${created.id} did not appear in the list`)
      throw error
    }
    navigate(Router.paths.sims(created.id))
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <fieldset class="fieldset bg-base-200 rounded-box shadow-sm p-2 mb-2 w-full">
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
