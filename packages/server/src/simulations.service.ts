import {SimConfig, Simulation} from "@sensor-sim/server";
import {PositionInput, SimConfigInput, SimCreateInput} from "./zodSchema";
import {createEventStream, EventStream} from "./util/eventStream";
import {randomOffset} from "./util/randomOffset";
import {createSimulationRuntime, SimulationRuntime} from "./simulationRuntime";
import {db} from "./db";
import {simConfigs} from "./db/schema";
import {eq} from "drizzle-orm";
import {Status} from "./types";

const defaultTarget = {latitude: 52.264683, longitude: 10.523783};


export interface SimulationService {
  list: () => Simulation[];
  shutdown: () => void;
  status: () => Status;
  statusStream: EventStream<Status>;

  createSim: (ownerId: number, createInput: SimCreateInput) => Promise<Simulation>;
  get: (id: string) => Simulation | undefined;
  getSimStream: (id: string) => EventStream<Simulation> | undefined;
  update: (id: string, updateInput: SimConfigInput) => Promise<Simulation>;
  updateCurrent: (id: string, positionInput: PositionInput) => Promise<Simulation>;
  startSim: (id: string) => Promise<void>;
  stopSim: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export async function createSimulationService(): Promise<SimulationService> {

  const startedAt = Date.now();
  let simListUpdatedAt = Date.now();

  const simulationRuntimes = new Map<string, SimulationRuntime>();

  // load simConfigs, add and start simulations
  const loadedConfigs = await db.query.simConfigs.findMany()

  loadedConfigs.forEach(config => {
    const simRuntime = createSimulationRuntime(config);
    simulationRuntimes.set(config.id, simRuntime);
    simRuntime.update(config)
  })

  const statusStream = createEventStream(() => status());

  statusStream.emit();

  function list(): Simulation[] {
    return [...simulationRuntimes.values()].map(simRuntime => simRuntime.sim)
  }

  // stops all timers so the process can exit cleanly on shutdown
  function shutdown() {
    for (const simRuntime of simulationRuntimes.values()) {
      simRuntime.updatePlaying(false);
    }
  }

  // individual simulation lifecycle
  // -----------------------------------------------------------

  async function createSim(ownerId: number, createInput: SimCreateInput) {
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
      ownerId: ownerId,
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
    simListUpdatedAt = Date.now();
    simRuntime.update(config)
    statusStream.emit();
    return simRuntime.sim;
  }


  function get(id: string) {
    return simulationRuntimes.get(id)?.sim;
  }

  function getSimStream(id: string) {
    return simulationRuntimes.get(id)?.simStream;
  }

  async function update(id: string, configInput: SimConfigInput) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) throw new Error(`Sim ${id} not found`);
    simRuntime.update(configInput);
    await storeConfig(id)
    return simRuntime.sim;
  }

  async function updateCurrent(id: string, positionInput: PositionInput) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) throw new Error(`Sim ${id} not found`);
    simRuntime.updateCurrent(positionInput);
    await storeConfig(id)
    return simRuntime.sim;
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

  async function remove(id: string) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) return;
    await db.delete(simConfigs).where(eq(simConfigs.id, id))
    simRuntime.updatePlaying(false);
    simulationRuntimes.delete(id);
    simListUpdatedAt = Date.now();
    statusStream.emit();
  }

  async function storeConfig(id: string) {
    const simRuntime = simulationRuntimes.get(id);
    if (!simRuntime) return;
    await db
      .update(simConfigs)
      .set(simRuntime?.sim.config)
      .where(eq(simConfigs.id, id))
  }

  function status() {
    return {
      startedAt,
      simListUpdatedAt,
      numSims: simulationRuntimes.size,
    }
  }


  return {
    list, shutdown,
    status, statusStream,
    createSim: createSim, get, getSimStream,
    update, updateCurrent, startSim, stopSim,
    remove
  };
}
