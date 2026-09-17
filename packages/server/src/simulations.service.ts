import {SimConfig, Simulation} from "@sensor-sim/server";
import {PositionInput, SimConfigInput, SimCreateInput} from "./zodSchema";
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

  async function create(createInput: SimCreateInput) {
    if (simulationRuntimes.has(createInput.id)) throw new Error(`Sim ${createInput.id} already exists`);

    // use default values, when missing
    const target = createInput.target ? createInput.target : randomOffset(defaultTarget, 200, 300);
    const initialDistance = createInput.initialDistance ? createInput.initialDistance : Math.random() * 50 + 60;
    const initialAzimuth = createInput.initialAzimuth ? createInput.initialAzimuth : Math.random() * 360;
    const type = createInput.type ? createInput.type : "follow";
    const speed = createInput.speed ? createInput.speed : 20;
    const playing = createInput.playing ?? true;

    const config: SimConfig = {
      id: createInput.id,
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

  async function update(id: string, configInput: SimConfigInput) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) throw new Error(`Sim ${id} not found`);
    simRuntime.update(configInput);
    await storage.setItem(`sims:${simRuntime.sim.config.id}`, simRuntime.sim.config)
    simListStream.emit();
    return simRuntime.sim;
  }

  async function updateCurrent(id: string, positionInput: PositionInput) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) throw new Error(`Sim ${id} not found`);
    simRuntime.updateCurrent(positionInput);
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

  const tickInterval = setInterval(() => {
    const now = Date.now();
    const deltaMs = now - lastTick;
    lastTick = now;
    simListStream.emit()
  }, 100);

  // stops all timers so the process can exit cleanly on shutdown
  function shutdown() {
    clearInterval(tickInterval);
    for (const simRuntime of simulationRuntimes.values()) {
      simRuntime.stop();
    }
  }

  return {
    get, create, update, updateCurrent,
    remove, list, simListStream,
    startSim, stopSim, getSimStream, shutdown
  };
}
