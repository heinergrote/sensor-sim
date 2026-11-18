import {createSignal, Show} from "solid-js";
import {
  TbFillPlayerPlay,
  TbFillPlayerStop,
  TbFillTrash,
  TbOutlineCircle,
  TbOutlineClipboard,
  TbOutlineMapPin,
  TbOutlinePolygon,
  TbOutlineShare,
  TbOutlineShareOff,
  TbOutlineX
} from "solid-icons/tb";
import {SimConfig, SpecType} from "@sensor-sim/shared";
import {useSimConfigsApi} from "../../service/configs.service";
import {serverUrl} from "../../api";
import {SpecEditor} from "./editors/SpecEditor";

const shareUrl = (token: string) => serverUrl + "/s/" + token

export function SimCard(props: { simConfig: SimConfig }) {

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
      await updateType(type === "_none" ? null : type)
    } catch (error) {
      setSelectedType(committedType()) // rejected: show the committed type again
      throw error
    }
  }

  async function updateType(type: SpecType | null) {
    await api.updateType(props.simConfig.id, type)
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
    <Show fallback={<div>Loading...</div>} when={props.simConfig}>
      {(config) =>
        <div class="flex flex-wrap w-full gap-2 mb-2">

          <div class="card grow shadow-sm bg-base-300">
            <div class="card-body p-4 gap-2 min-w-60">
              <div class="flex items-center gap-2">
                <span class={"text-2xl font-thin text-nowrap"}>{config().label}</span>
                <Show when={config().spec}>
                  <select class="select select-sm w-fit min-w-24" onChange={handleTypeChange}>
                    <option value={"_none"} defaultSelected={selectedType() === "_none"}>None</option>
                    <option value={"fixed"} defaultSelected={selectedType() === "fixed"}>Fixed</option>
                    <option value={"path"} defaultSelected={selectedType() === "path"}>Path</option>
                    <option value={"orbit"} defaultSelected={selectedType() === "orbit"}>Orbit</option>
                  </select>
                </Show>

              </div>


              <div class="flex gap-1 items-center">
                <button class="btn btn-sm"
                        onClick={() => api.share(config().id, config().shareToken.length === 0)}>
                  <Show when={config().shareToken}><TbOutlineShareOff/></Show>
                  <Show when={!config().shareToken}><TbOutlineShare/> Share</Show>
                </button>
                <Show when={config().shareToken}>
                  <button class="btn btn-sm" onClick={() => {
                    navigator.clipboard.writeText(shareUrl(config().shareToken)); // copy the full url
                  }}>
                    <TbOutlineClipboard/>
                  </button>
                  <a class="link text-nowrap" href={shareUrl(config().shareToken)} target="_blank"
                     rel="noopener noreferrer">{config().shareToken}</a>
                </Show>
              </div>

              <Show when={confirmDeleteId() === config().id}>
                <div class="flex gap-1">
                  <button class="btn btn-sm btn-error" onClick={() => handleDelete(config().id)}>
                    <TbFillTrash/> Really?
                  </button>
                  <button class="btn btn-sm" onClick={() => handleDelete(null)}>
                    <TbOutlineX/>
                  </button>
                </div>
              </Show>
              <Show when={confirmDeleteId() !== config().id}>
                <div class="flex">
                  <button class="btn btn-sm" onClick={() => handleDelete(config().id)}><TbFillTrash/> Delete</button>
                </div>
              </Show>

            </div>
          </div>

          <div class="card grow-999 basis-0 shadow-sm bg-base-300">
            <div class="card-body p-4 gap-1">
              <Show when={config().spec}
                    fallback={
                      <>
                        <div>Select a Type</div>
                        <div class="flex">
                          <button class="btn" onClick={() => updateType("fixed")}>
                            <TbOutlineMapPin/> Fixed
                          </button>
                          <button class="btn" onClick={() => updateType("path")}>
                            <TbOutlinePolygon/> Path
                          </button>
                          <button class="btn" onClick={() => updateType("orbit")}>
                            <TbOutlineCircle/> Orbit
                          </button>
                        </div>
                      </>
                    }
              >
                <button class="btn btn-sm" onClick={() => api.startStop(config().id, !config().playing)}>
                  <Show when={config().playing}><TbFillPlayerStop/> Stop</Show>
                  <Show when={!config().playing}><TbFillPlayerPlay/> Play</Show>
                </button>
                <SpecEditor config={config()}/>
              </Show>
            </div>
          </div>

        </div>

      }
    </Show>
  )
}
