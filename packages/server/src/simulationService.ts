import {SimConfig, Simulation} from "@sensor-sim/server";
import {SimConfigInput, SimUpdateCurrentInput, SimUpdateTargetInput} from "./schema";
import {createEventStream} from "./util/eventStream";
import {randomOffset} from "./util/randomOffset";
import {createSimulationRuntime, SimulationRuntime} from "./simulationRuntime";
import {getStorage} from "./storage";

const defaultTarget = {latitude: 52.264683, longitude: 10.523783};

export async function createSimulationService() {

  const simulationRuntimes = new Map<string, SimulationRuntime>();
  const storage = getStorage()

  // Returns undefined for unknown ids so callers can answer with a 404
  // instead of an unhandled throw turning into a 500.
  function get(id: string) {
    return simulationRuntimes.get(id)?.sim;
  }

  async function create(configInput: SimConfigInput) {
    if (simulationRuntimes.has(configInput.id)) throw new Error(`Sim ${configInput.id} already exists`);

    // use default values, when missing
    const target = configInput.target ? configInput.target : randomOffset(defaultTarget, 200, 300);
    const initialDistance = configInput.initialDistance ? configInput.initialDistance : Math.random() * 50 + 60;
    const initialAzimuth = configInput.initialAzimuth ? configInput.initialAzimuth : Math.random() * 360;
    const type = configInput.type ? configInput.type : "follow";
    const speed = configInput.speed ? configInput.speed : 20;
    const playing = configInput.playing ?? true;

    const config: SimConfig = {
      id: configInput.id,
      target: target,
      initialDistance: initialDistance,
      initialAzimuth: initialAzimuth,
      type: type,
      speed: speed,
      playing: playing,
    };

    const simRuntime = createSimulationRuntime(config);
    await storage.setItem(`sims:${config.id}`, config)
    simulationRuntimes.set(config.id, simRuntime);
    simRuntime.update(config)
    simListStream.emit();

    return simRuntime.sim;
  }

  async function updateTarget(updateTargetInput: SimUpdateTargetInput) {
    const simRuntime = simulationRuntimes.get(updateTargetInput.id);
    if (!simRuntime) throw new Error(`Sim ${updateTargetInput.id} not found`);
    simRuntime.update(updateTargetInput);
    await storage.setItem(`sims:${simRuntime.sim.config.id}`, simRuntime.sim.config)
    simListStream.emit();
    return simRuntime.sim;
  }

  async function updateCurrent(updateCurrentInput: SimUpdateCurrentInput) {
    const simRuntime = simulationRuntimes.get(updateCurrentInput.id);
    if (!simRuntime) throw new Error(`Sim ${updateCurrentInput.id} not found`);
    simRuntime.updateCurrent(updateCurrentInput);
    await storage.setItem(`sims:${simRuntime.sim.config.id}`, simRuntime.sim.config)
    simListStream.emit();
    return simRuntime.sim;
  }


  async function remove(id: string) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) return;
    await storage.removeItem(`sims:${id}`);
    simulationRuntimes.delete(id);
    simRuntime.stop();
    simListStream.emit();
  }

  function list(): Simulation[] {
    return [...simulationRuntimes.values()].map(simRuntime => simRuntime.sim)
  }

  const simListStream = createEventStream(() => list());

  function getSimStream(id: string) {
    return simulationRuntimes.get(id)?.simStream;
  }

  async function startSim(id: string) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) return;
    simRuntime.start(true)
    await storage.setItem(`sims:${simRuntime.sim.config.id}`, simRuntime.sim.config)
  }

  async function stopSim(id: string) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) return;
    simRuntime.stop()
    await storage.setItem(`sims:${simRuntime.sim.config.id}`, simRuntime.sim.config)
  }

  // load simConfigs, add and start simulations
  const loadedKeys = await storage.getKeys("sims")

  for (const key of loadedKeys) {
    const config = await storage.getItem<SimConfig>(key);
    if (config) {
      const simRuntime = createSimulationRuntime(config);
      simulationRuntimes.set(config.id, simRuntime);
      simRuntime.update(config)
    }
  }
  simListStream.emit();


  let lastTick = Date.now();

  setInterval(() => {
    const now = Date.now();
    const deltaMs = now - lastTick;
    lastTick = now;
    simListStream.emit()
  }, 500);

  return {
    get, create, updateTarget, updateCurrent,
    remove, list, simListStream,
    startSim, stopSim, getSimStream
  };
}
