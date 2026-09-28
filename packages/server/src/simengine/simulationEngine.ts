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

  await syncConfigs()

  // load persisted simConfigs, add and start simulations
  async function syncConfigs() {
    const configs = await getSimConfigs();
    configs.forEach(config => {
      const simRunner = get(config.id)

      if (!simRunner) {
        const simRunner = createSimulationRunner(config);
        simulationRunners.set(config.id, simRunner);
      } else {
        simRunner.applySimConfig(config);
      }

    })
  }

  function list(ownerId: number): SimulationRunner[] {
    const allRunners = [...simulationRunners.values()]
    return allRunners.filter(runner => runner.config.ownerId === ownerId)
  }

  // stops all timers so the process can exit cleanly on shutdown
  function shutdown() {
    for (const simRuntime of simulationRunners.values()) {
      simRuntime.stop();
    }
  }


  function get(id: number) {
    return simulationRunners.get(id);
  }

  return {
    get, list, shutdown, syncConfigs
  } as SimulationEngine;
}
