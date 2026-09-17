import {SimConfig, Simulation} from "@sensor-sim/server";
import {PositionInput, SimConfigInput, SimCreateInput} from "./zodSchema";
import {createEventStream} from "./util/eventStream";
import {randomOffset} from "./util/randomOffset";
import {createSimulationRuntime, SimulationRuntime} from "./simulationRuntime";
import {db} from "./db";
import {simConfigs} from "./db/schema";
import {eq} from "drizzle-orm";

const defaultTarget = {latitude: 52.264683, longitude: 10.523783};

export async function createSimulationService() {

  const simulationRuntimes = new Map<string, SimulationRuntime>();

  // Returns undefined for unknown ids so callers can answer with a 404
  // instead of an unhandled throw turning into a 500.
  function get(id: string) {
    return simulationRuntimes.get(id)?.sim;
  }

  async function create(createInput: SimCreateInput) {
    if (simulationRuntimes.has(createInput.id)) throw new Error(`Sim ${createInput.id} already exists`);

    // use default values, when missing
    const target = (createInput.targetLatitude === undefined || createInput.targetLongitude === undefined) ?
      randomOffset(defaultTarget, 200, 300)
      :
      {latitude: createInput.targetLatitude, longitude: createInput.targetLongitude};

    const initialDistance = createInput.initialDistance ? createInput.initialDistance : Math.random() * 50 + 60;
    const initialAzimuth = createInput.initialAzimuth ? createInput.initialAzimuth : Math.random() * 360;
    const type = createInput.type ? createInput.type : "follow";
    const speed = createInput.speed ? createInput.speed : 20;
    const playing = createInput.playing ?? true;

    const config: SimConfig = {
      id: createInput.id,
      targetLatitude: target.latitude,
      targetLongitude: target.longitude,
      initialDistance: initialDistance,
      initialAzimuth: initialAzimuth,
      type: type,
      speed: speed,
      playing: playing,
    };

    const simRuntime = createSimulationRuntime(config);
    await db
      .insert(simConfigs)
      .values(config)
    simulationRuntimes.set(config.id, simRuntime);
    simRuntime.update(config)
    simListStream.emit();
    return simRuntime.sim;
  }

  async function update(id: string, configInput: SimConfigInput) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) throw new Error(`Sim ${id} not found`);
    simRuntime.update(configInput);
    await storeConfig(id)
    simListStream.emit();
    return simRuntime.sim;
  }

  async function updateCurrent(id: string, positionInput: PositionInput) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) throw new Error(`Sim ${id} not found`);
    simRuntime.updateCurrent(positionInput);
    await storeConfig(id)
    simListStream.emit();
    return simRuntime.sim;
  }


  async function remove(id: string) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) return;
    await db.delete(simConfigs).where(eq(simConfigs.id, id))
    simRuntime.updatePlaying(false);
    simulationRuntimes.delete(id);
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
    simRuntime.updatePlaying(true)
    await storeConfig(id)
  }

  async function stopSim(id: string) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) return;
    simRuntime.updatePlaying(false)
    await storeConfig(id)
  }

  // stops all timers so the process can exit cleanly on shutdown
  function shutdown() {
    clearInterval(tickInterval);
    for (const simRuntime of simulationRuntimes.values()) {
      simRuntime.updatePlaying(false);
    }
  }

  async function storeConfig(id: string) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) return;
    await db
      .update(simConfigs)
      .set(simRuntime?.sim.config)
      .where(eq(simConfigs.id, id))
  }


  // load simConfigs, add and start simulations
  const loadedConfigs = await db.query.simConfigs.findMany()

  loadedConfigs.forEach(config => {
    const simRuntime = createSimulationRuntime(config);
    simulationRuntimes.set(config.id, simRuntime);
    simRuntime.update(config)
  })
  simListStream.emit();

  const tickInterval = setInterval(() => {
    simListStream.emit()
  }, 100);

  return {
    get, create, update, updateCurrent,
    remove, list, simListStream,
    startSim, stopSim, getSimStream, shutdown
  };
}
