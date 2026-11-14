import {createSignal, Show} from "solid-js";
import {
  TbFillPlayerPlay,
  TbFillPlayerStop,
  TbFillTrash,
  TbOutlineClipboard,
  TbOutlineClockPlus,
  TbOutlineClockUp,
  TbOutlineShare,
  TbOutlineShareOff,
  TbOutlineX
} from "solid-icons/tb";
import {useMatch, useNavigate} from "@solidjs/router";
import {SimConfig, SpecType} from "@sensor-sim/shared";
import {paths} from "../../router";
import {useSimConfigsApi} from "../../service/configs.service";
import {SpecEditor} from "./editors/SpecEditor";
import {serverUrl} from "../../api";

export function SimCard(props: { simConfig: SimConfig }) {

  const navigate = useNavigate()
  const selected = useMatch(() => paths.sims(props.simConfig.id));

  const [confirmDeleteId, setConfirmDeleteId] = createSignal<number | null>(null)


  const api = useSimConfigsApi()

  // draft of the select: follows the config, but takes the user's pick immediately so the `selected`
  // bindings don't write the old type back while the update is in flight
  const committedType = () => props.simConfig.spec?.type ?? "_none"
  const [selectedType, setSelectedType] = createSignal<SpecType | "_none">(committedType)

  async function handleTypeChange(event: Event & { currentTarget: HTMLSelectElement }) {
    const type = event.currentTarget.value as SpecType | "_none"
    setSelectedType(type)
    try {
      await api.updateType(props.simConfig.id, type === "_none" ? null : type)
    } catch (error) {
      setSelectedType(committedType()) // rejected: show the committed type again
      throw error
    }
  }

  function handleSelect() {
    navigate(selected() ? `/sims` : `/sims/${props.simConfig.id}`)
  }

  function handleDelete(id: number | null) {

    if (id && confirmDeleteId() === id) {
      api.remove(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
    }

  }


  return (
    <>
      <Show fallback={<div>Connecting...</div>} when={props.simConfig}>
        {(config) =>
          <>

            <div class={["card w-full shadow-sm mb-2", selected() ? "bg-base-300" : "bg-base-200"]}>
              <div class="card-body p-4">

                <div class="flex items-center gap-2">
                  <span>{config().label}</span>
                  <select class="select select-sm w-fit" onChange={handleTypeChange}>
                    <option value={"_none"} defaultSelected={selectedType() === "_none"}>None</option>
                    <option value={"fixed"} defaultSelected={selectedType() === "fixed"}>Fixed</option>
                    <option value={"path"} defaultSelected={selectedType() === "path"}>Path</option>
                    <option value={"orbit"} defaultSelected={selectedType() === "orbit"}>Orbit</option>
                  </select>
                  <button class="btn btn-sm" onClick={() => api.startStop(config().id, !config().playing)}>
                    <Show when={config().playing}><TbFillPlayerStop/> Stop</Show>
                    <Show when={!config().playing}><TbFillPlayerPlay/> Play</Show>
                  </button>
                  <div class={"flex-1"}/>
                  <button class="btn btn-sm btn-primary" onClick={handleSelect}>Select</button>
                </div>

                <Show when={selected()}>
                  <div class="flex-1 flex flex-col gap-1">
                    <div class={"divider my-0"}/>
                    <Show when={config().spec}>
                      <SpecEditor config={config()}/>
                      <div class={"divider my-0"}/>
                    </Show>
                    <div class={"flex gap-1 items-center"}>
                      <TbOutlineClockPlus/> {new Date(config().createdAt).toLocaleString()}
                      <TbOutlineClockUp/> {new Date(config().updatedAt).toLocaleString()}
                    </div>
                    <div class="flex gap-1 items-center">
                      <button class="btn btn-sm"
                              onClick={() => api.share(config().id, config().shareToken.length === 0)}>
                        <Show when={config().shareToken}><TbOutlineShareOff/> Unshare</Show>
                        <Show when={!config().shareToken}><TbOutlineShare/> Share</Show>
                      </button>
                      <Show when={config().shareToken}>
                        <div class="truncate flex-1" id="shareUrl">{serverUrl + "/s/" + config().shareToken}</div>
                        <button class="btn btn-sm" onClick={() => {
                          // copy to clipboard
                          navigator.clipboard.writeText(serverUrl + "/s/" + config().shareToken);
                        }}>
                          <TbOutlineClipboard/>
                        </button>
                      </Show>
                    </div>
                    <Show when={confirmDeleteId() === config().id}>
                      <div class="flex justify-center gap-1">
                        <button class="btn btn-sm btn-error" onClick={() => handleDelete(config().id)}>
                          <TbFillTrash/> Really?
                        </button>
                        <button class="btn btn-sm" onClick={() => handleDelete(null)}>
                          <TbOutlineX/>
                        </button>
                      </div>
                    </Show>
                    <Show when={confirmDeleteId() !== config().id}>
                      <div class="flex justify-end">
                        <button class="btn btn-sm" onClick={() => handleDelete(config().id)}><TbFillTrash/></button>
                      </div>
                    </Show>

                  </div>
                </Show>


              </div>
            </div>

          </>
        }
      </Show>
    </>
  )
}
