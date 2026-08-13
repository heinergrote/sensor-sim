import {SimConfig, Simulation} from "@sensor-sim/shared";
import {SimConfigInput} from "./trcp/appRouter";
import {createEventStream} from "./eventStream";
import {randomOffset} from "./util/randomOffset";
import {createSimulationRuntime, SimulationRuntime} from "./simulationRuntime";

const defaultTarget = {latitude: 52.264683, longitude: 10.523783};

export function createSimulationService() {

  const simulationRuntimes = new Map<string, SimulationRuntime>();

  function get(id: string, createIfNotExists = false): Simulation | never {
    if (!simulationRuntimes.has(id) && createIfNotExists) {
      return create({id});
    }
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) throw new Error(`Sim ${id} not found`);
    return simRuntime.sim;
  }

  function create(configInput: SimConfigInput) {
    if (simulationRuntimes.has(configInput.id)) throw new Error(`Sim ${configInput.id} already exists`);

    // use default values, when missing
    const target = configInput.target ? configInput.target : randomOffset(defaultTarget, 200, 300);
    const initialDistance = configInput.initialDistance ? configInput.initialDistance : Math.random() * 50 + 60;
    const initialAzimuth = configInput.initialAzimuth ? configInput.initialAzimuth : Math.random() * 360;
    const type = configInput.type ? configInput.type : "follow";
    const speed = configInput.speed ? configInput.speed : 20;

    const config: SimConfig = {
      id: configInput.id,
      target: target,
      initialDistance: initialDistance,
      initialAzimuth: initialAzimuth,
      type: type,
      speed: speed,
    };

    const simRuntime = createSimulationRuntime(config);
    simulationRuntimes.set(config.id, simRuntime);
    simRuntime.start(config)

    configListStream.emit();

    return simRuntime.sim;
  }

  function update(configInput: SimConfigInput) {
    if (!simulationRuntimes.has(configInput.id)) {
      create(configInput);
    }
    const simRuntime = simulationRuntimes.get(configInput.id);
    if (!simRuntime) return; // should not happen
    simRuntime.start(configInput);
    configListStream.emit();

    return simRuntime.sim;
  }

  function remove(id: string) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) return;
    simulationRuntimes.delete(id);
    simRuntime.stop();
    configListStream.emit();
  }

  function list(): Simulation[] {
    return [...simulationRuntimes.values()].map(simRuntime => simRuntime.sim)
  }

  const configListStream = createEventStream(() => [...simulationRuntimes.keys()]);

  function getSimStream(id: string) {
    return simulationRuntimes.get(id)?.simStream;
  }

  function startSim(id: string) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) return;
    simRuntime.start();
  }

  function stopSim(id: string) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) return;
    simRuntime.stop();
  }


  return {
    get, create, update, remove, list, configListStream,
    startSim, stopSim, getSimStream
  };
}
