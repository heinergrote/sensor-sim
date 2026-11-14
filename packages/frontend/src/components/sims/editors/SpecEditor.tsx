import {Component, Show, useContext} from "solid-js";
import {Dynamic} from "@solidjs/web";
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

  const editor = () => {
    const type = props.config.spec?.type
    return type ? specEditors[type] as Component<SpecEditorProps<Spec>> : undefined
  }

  return (
    <Show when={map()} fallback={<span class="text-sm opacity-60">Loading map…</span>}>
      {(map) => (
        <Show when={props.config.spec}>
          {(spec) => <Dynamic component={editor()} configId={props.config.id} spec={spec()} map={map()}/>}
        </Show>
      )}
    </Show>
  )
}
