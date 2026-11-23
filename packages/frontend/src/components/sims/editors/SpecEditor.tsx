import {Component, Show, useContext} from "solid-js";
import {dynamic} from "@solidjs/web";
import type {MapLibreMap} from "maplibre-gl";
import {SimConfig, Spec, SpecType} from "@sensor-sim/shared";
import {MapContext} from "./mapContext";
import FixedEditor from "./FixedEditor";
import OrbitEditor from "./OrbitEditor";
import PathEditor from "./PathEditor";

/**
 * A spec editor owns everything type-specific about editing a spec: its map objects (markers, draw controls —
 * created when mounted, removed on cleanup) and its UI (draft display, Save/Reset). Mount at most one, for the
 * sim that is on the map.
 */
export type SpecEditorProps<T extends Spec> = {
  configId: number,
  spec: T,
  /** changes with every server-side write of the config — a cheap marker for "the spec may have changed" */
  updatedAt: SimConfig["updatedAt"],
  map: MapLibreMap,
}

// one editor per spec type — a new type fails to compile here until it has one
const specEditors: { [K in SpecType]: Component<SpecEditorProps<Extract<Spec, { type: K }>>> } = {
  fixed: FixedEditor,
  path: PathEditor,
  orbit: OrbitEditor,
}

export function SpecEditor(props: { config: SimConfig }) {
  const map = useContext(MapContext)

  // pick an editor based on the spec type
  const Editor = dynamic(() => {
    const type = props.config.spec?.type
    return type ? specEditors[type] as Component<SpecEditorProps<Spec>> : undefined
  });

  return (
    <Show when={map()} fallback={<span class="text-sm opacity-60">Loading map…</span>}>
      {(map) => (
        <Show when={props.config.spec}>
          {(spec) => <Editor configId={props.config.id} spec={spec()} updatedAt={props.config.updatedAt}
                             map={map()}/>}
        </Show>
      )}
    </Show>
  )
}
