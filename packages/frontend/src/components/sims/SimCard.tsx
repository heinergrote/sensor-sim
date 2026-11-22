import {Show} from "solid-js";
import {
  TbFillPlayerPlay,
  TbFillPlayerStop,
  TbOutlineCircle,
  TbOutlineClipboard,
  TbOutlineMapPin,
  TbOutlinePolygon,
  TbOutlineShare,
  TbOutlineShareOff,
  TbOutlineX
} from "solid-icons/tb";
import {SimConfig, SpecType} from "@sensor-sim/shared";
import {shareConfig, startStopConfig, updateConfigType} from "../../service/configs.service";
import {serverUrl} from "../../api";
import {SpecEditor} from "./editors/SpecEditor";

const shareUrl = (token: string) => serverUrl + "/s/" + token

export function SimCard(props: { simConfig: SimConfig }) {

  async function updateType(type: SpecType | null) {
    await updateConfigType(props.simConfig.id, type)
  }


  return (
    <Show fallback={<div>Loading...</div>} when={props.simConfig}>
      {(config) =>
        <div class="flex flex-wrap w-full gap-2 mb-2">

          <div class="card grow shadow-sm bg-base-300">
            <div class="card-body p-4 gap-1 min-w-60">
              <div class={"text-2xl font-thin text-nowrap"}>{config().label}</div>

              <Show when={config().spec}>
                <div class="flex gap-1 items-center">
                  Type: {config().spec?.type}
                  <button class="btn btn-sm btn-square btn-ghost" onClick={() => updateType(null)}><TbOutlineX/>
                  </button>
                </div>
              </Show>

              <div class="flex gap-1 items-center">
                <button class="btn btn-sm w-20"
                        onClick={() => shareConfig(config().id, config().shareToken.length === 0)}>
                  <Show when={config().shareToken}><TbOutlineShareOff/> Share</Show>
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
                <button class="btn btn-sm" onClick={() => startStopConfig(config().id, !config().playing)}>
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
