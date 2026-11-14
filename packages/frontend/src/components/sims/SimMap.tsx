import {createEffect, createSignal, onSettled, Show} from "solid-js";
import {jwtToken} from "../../auth";
import {createSimulationMap, SimulationMap} from "./simulationMap";
import {SimConfig} from "@sensor-sim/shared";
import {PortalControl} from "./PortalControl";
import {Portal} from "@solidjs/web";
import {TbOutlineCloudUpload} from "solid-icons/tb";


export default function SimMap(props: { simConfig: SimConfig | undefined }) {

  let mapEl!: HTMLDivElement

  // Instantiate the control container immediately
  const editControl = new PortalControl();

  const [simulationMap, setSimulationMap] = createSignal<SimulationMap>();

  // createEffect(() => props.simConfig && JSON.parse(JSON.stringify(props.simConfig)),
  //   (config) => {
  //     console.log("simConfig changed ", config)
  //   }
  // )
  //
  // createEffect(() => props.simConfig && props.simConfig.spec && JSON.parse(JSON.stringify(props.simConfig.spec)),
  //   (spec) => {
  //     console.log("simConfig spec changed ", spec)
  //   }
  // )

  createEffect(() => {
      const config = props.simConfig
      return {
        simulationMap: simulationMap(),
        // Plain copy built from ordinary property reads (tracks every field the map uses). Not `deep()`: with
        // solid-js 2.0.0-rc.21, deep() over a createOptimisticStore row spins in snapshotWalk on the second
        // optimistic `update` (e.g. moving the speed slider twice) and freezes the tab.
        // see https://github.com/solidjs/solid/issues/4771
        // Freezing version: config: props.simConfig ? deep(props.simConfig) : null
        config: config ? {...config, spec: config.spec && JSON.parse(JSON.stringify(config.spec))} : null

      }
    },

    ({simulationMap, config}) => {
      if (simulationMap) {
        simulationMap.attachSimConfig(config)
        simulationMap.map.addControl(editControl, 'top-left')
      }
    },
    {name: "simMap.attach"}
  )

  onSettled(
    () => {
      createSimulationMap(mapEl, jwtToken()).then(simulationMap => {
        setSimulationMap(simulationMap)
      });
      return () => {
        simulationMap()?.dispose()
      }
    }
  )

  return (
    <>
      <div class="w-full h-full rounded-lg shadow-sm" ref={mapEl}/>

      {/* Render your Solid component directly into MapLibre's control slot */}
      <Show when={simulationMap()}>
        {(simulationMap) => (
          <Portal mount={editControl.container}>
            <EditControls simulationMap={simulationMap()}/>
          </Portal>
        )}
      </Show>

    </>
  );

}

function EditControls(props: { simulationMap: SimulationMap }) {
  return (
    <div class="w-40 h-10">
      <button class={"btn"} onClick={() => props.simulationMap.editController?.save()}>
        <TbOutlineCloudUpload size={20}/> Save
      </button>
    </div>
  );
}