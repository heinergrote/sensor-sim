import {useSimConfigsApi} from "../../service/configs.service";

export default function SimForm() {

  const api = useSimConfigsApi()

  function handleSubmit(e: SubmitEvent & { currentTarget: HTMLFormElement }) {
    e.preventDefault()
    const form = e.currentTarget
    const label = new FormData(form).get("label") as string
    form.reset()
    api.add(label)
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
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
