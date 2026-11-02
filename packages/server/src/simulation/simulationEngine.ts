import {createSimulationRunner, SimulationRunner} from "./simulationRunner";
import {getSimConfigs} from "../simconfigs/simconfigs.repository";

export interface SimulationEngine {
  get: (id: number) => SimulationRunner | undefined;
  list: (ownerId: number) => SimulationRunner[];
  shutdown: () => void;
  syncConfigs: () => Promise<void>;
}

export async function createSimulationEngine(): Promise<SimulationEngine> {

  const simulationRunners = new Map<number, SimulationRunner>();

  // concurrent requests may call syncConfigs() in parallel; run them one after another, so an older config list
  // can never be applied after a newer one (and e.g. dispose a runner that was just created)
  let syncQueue: Promise<void> = Promise.resolve();

  await syncConfigs()

  function syncConfigs(): Promise<void> {
    // run even if the previous sync failed; the caller still gets this sync's own result
    return syncQueue = syncQueue.then(doSyncConfigs, doSyncConfigs);
  }

  // load persisted simConfigs, add and start simulations
  async function doSyncConfigs() {
    const configs = await getSimConfigs();

    // add or update simulationRunners
    configs.forEach(config => {
      const simRunner = get(config.id)

      if (!simRunner) {
        const simRunner = createSimulationRunner(config);
        simulationRunners.set(config.id, simRunner);
      } else {
        simRunner.applySimConfig(config);
      }
    })

    // delete old simulationRunners not present in configs
    simulationRunners.forEach(simRunner => {
      if (!configs.find(config => config.id === simRunner.config.id)) {
        simRunner.dispose()
        simulationRunners.delete(simRunner.config.id)
      }
    })

  }

  function list(ownerId: number): SimulationRunner[] {
    const allRunners = [...simulationRunners.values()]
    return allRunners.filter(runner => runner.config.ownerId === ownerId)
  }

  // stops all runners
  function shutdown() {
    for (const simRuntime of simulationRunners.values()) {
      simRuntime.dispose();
      simulationRunners.delete(simRuntime.config.id)
    }
  }


  function get(id: number) {
    return simulationRunners.get(id);
  }

  return {
    get, list, shutdown, syncConfigs
  } as SimulationEngine;
}
