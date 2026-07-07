import {createSimulation, Simulation} from "./simulation";
import {SimulationData} from "@sensor-sim/shared";

export type SimulationRegistry = ReturnType<typeof createSimulationRegistry>;

function createSimulationRegistry() {
  const registry = new Map<string, Simulation>();

  function get(id: string, createIfNotExists = false): Simulation | never {
    if (!registry.has(id) && createIfNotExists)
      return create(id, "follow");
    const sim = registry.get(id);
    if (!sim) throw new Error(`Sim ${id} not found`);
    return sim;
  }

  function create(id: string, type: "follow" | "circle") {
    if (registry.has(id)) throw new Error(`Sim ${id} already exists`);
    const sim = createSimulation(id);
    sim.setType(type);
    sim.start();
    registry.set(id, sim);
    console.log(`Sim created: ${id} (${type})`);
    notifyListeners();
    return sim;
  }

  function remove(id: string) {
    const sim = registry.get(id);
    if (!sim) return;
    sim.stop();
    registry.delete(id);
    console.log(`Sim deleted: ${id}`);
    notifyListeners();
  }

  function list(): SimulationData[] {
    return [...registry.values()]
  }


  const listeners = new Set<(ids: string[]) => void>();

  function addListener(listener: (ids: string[]) => void) {
    listeners.add(listener);
  }

  function notifyListeners() {
    for (const listener of listeners) listener([...registry.keys()]);
  }

  function removeListener(listener: (ids: string[]) => void) {
    listeners.delete(listener);
  }


  function listChange(): Promise<void> {
    // return a Promise that resolves, when a new simulation is created or deleted
    return new Promise(resolve => {
      const listener = (ids: string[]) => {
        removeListener(listener);
        resolve();
      };
      addListener(listener);
    });
  }

  return {get, create, remove, list, listChange};
}


export {createSimulationRegistry};