import {SimConfig} from "@sensor-sim/shared";
import {createSimulation, Simulation} from "./simulation";


export type SimulationRegistry = ReturnType<typeof createSimulationRegistry>;

export function createSimulationRegistry() {

  const simulations = new Map<string, Simulation>();

  function create(config: SimConfig) {

    if (simulations.has(config.id)) throw new Error(`Sim ${config.id} already exists`);

    const simulation = createSimulation(config.id);
    simulations.set(config.id, simulation);
    simulation.start(config)

    return simulation;
  }

  function update(config: SimConfig) {

    const simulation = simulations.get(config.id);
    if (simulation) {
      simulation.stop();
      simulation.start(config);
    }
    return simulation;
  }

  function remove(id: string) {
    const simulation = simulations.get(id);
    if (simulation) {
      simulation.stop();
      simulations.delete(id);
    }
  }

  function getSimulationDataStream(id: string) {
    return simulations.get(id)?.simulationDataStream;
  }

  return {
    create, update, remove,
    getSimulationDataStream
  };
}
