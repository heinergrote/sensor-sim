import {createSimulationRunner, SimulationRunner} from "./simulationRunner";
import {getSimConfigs} from "../simconfigs/simconfigs.repository";


// export interface SimulationService {
//   list: (ownerId: number) => Simulation[];
//   shutdown: () => void;
//   status: () => Status;
//   statusStream: EventStream<Status>;
//
//   createSim: (ownerId: number, createInput: CreateSimConfigDto) => Promise<Simulation>;
//   get: (id: number) => Simulation | undefined;
//   getSimStream: (id: number) => EventStream<Simulation> | undefined;
//   update: (id: number, updateInput: UpdateSimConfigDto) => Promise<Simulation>;
//   updateCurrent: (id: number, positionInput: PositionDto) => Promise<Simulation>;
//   startSim: (id: number) => Promise<void>;
//   stopSim: (id: number) => Promise<void>;
//   share: (id: number, shareToken: string) => Promise<void>;
//   unshare: (id: number) => Promise<void>;
//   remove: (id: number) => Promise<void>;
// }

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
        simRunner.updateConfig(config);
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

  // async function update(id: number, config: SimConfigDto) {
  //   const simRuntime = simulationRuntimes.get(id);
  //   if (!simRuntime) throw new Error(`Sim ${id} not found`);
  //   simRuntime.update(configInput);
  //   await storeConfig(id)
  //   return simRuntime.sim;
  // }
  //
  // async function updateCurrent(id: number, positionInput: PositionDto) {
  //   const simRuntime = simulationRuntimes.get(id);
  //   if (!simRuntime) throw new Error(`Sim ${id} not found`);
  //   simRuntime.updateCurrent(positionInput);
  //   await storeConfig(id)
  //   return simRuntime.sim;
  // }
  //
  // async function startSim(id: number) {
  //   const simRuntime = simulationRuntimes.get(id);
  //   if (!simRuntime) return;
  //   simRuntime.updatePlaying(true)
  //   await storeConfig(id)
  // }
  //
  // async function stopSim(id: number) {
  //   const simRuntime = simulationRuntimes.get(id);
  //   if (!simRuntime) return;
  //   simRuntime.updatePlaying(false)
  //   await storeConfig(id)
  // }
  //
  // async function remove(id: number) {
  //   const simRuntime = simulationRuntimes.get(id);
  //   if (!simRuntime) return;
  //   await db.delete(simConfigs).where(eq(simConfigs.id, id))
  //   simRuntime.updatePlaying(false);
  //   simulationRuntimes.delete(id);
  //   simListUpdatedAt = Date.now();
  //   statusStream.emit();
  // }


  return {
    get, list, shutdown, syncConfigs
  } as SimulationEngine;
}
