import {SimConfig} from "@sensor-sim/shared";
import * as turf from "@turf/turf";
import {SimConfigInput} from "./trcp/appRouter";
import {createEventStream} from "./eventStream";
import {createSimulation, Simulation} from "./simulation";

function randomOffset(origin: { latitude: number; longitude: number }, minMeters: number, maxMeters: number) {
  const bearing = Math.random() * 360;
  const distance = minMeters + Math.random() * (maxMeters - minMeters);
  const point = turf.destination(
    [origin.longitude, origin.latitude],
    distance,
    bearing,
    {units: "meters"}
  );
  return {
    longitude: point.geometry.coordinates[0],
    latitude: point.geometry.coordinates[1],
  };
}

const defaultTarget = {latitude: 52.264683, longitude: 10.523783};

export function createSimRegistry() {

  const simConfigs = new Map<string, SimConfig>();
  const simulations = new Map<string, Simulation>();

  function get(id: string, createIfNotExists = false): SimConfig | never {
    if (!simConfigs.has(id) && createIfNotExists)
      return create({id, type: "follow"});
    const simConfig = simConfigs.get(id);
    if (!simConfig) throw new Error(`Sim ${id} not found`);
    return simConfig;
  }

  function getSimulation(id: string): Simulation | never {
    const simulation = simulations.get(id);
    if (!simulation) throw new Error(`Simulation ${id} not found`);
    return simulation;
  }

  function create(data: SimConfigInput) {
    if (simConfigs.has(data.id)) throw new Error(`Sim ${data.id} already exists`);

    const target = data.target ? data.target : randomOffset(defaultTarget, 200, 300);
    const initial = data.initial ? data.initial : randomOffset(target, 50, 100);
    const type = data.type ? data.type : "follow";
    const speed = data.speed ? data.speed : 20;

    const simConfig: SimConfig = {
      id: data.id,
      target: target,
      initial: initial,
      type: type,
      speed: speed,
    };

    simConfigs.set(data.id, simConfig);

    const simulation = createSimulation(simConfig);
    simulation.start();
    simulations.set(data.id, simulation);

    console.log('SimConfig created:', simConfig);
    configListStream.emit();


    return simConfig;
  }

  function update(data: SimConfigInput) {
    const simConfig = get(data.id, true);
    if (data.type) simConfig.type = data.type;
    if (data.initial) simConfig.initial = {latitude: data.initial.latitude, longitude: data.initial.longitude};
    if (data.target) simConfig.target = {latitude: data.target.latitude, longitude: data.target.longitude};
    if (data.speed) simConfig.speed = data.speed;
    const simulation = simulations.get(data.id);
    if (simulation) simulation.updateConfig(simConfig);

    return simConfig
  }

  function remove(id: string) {
    const simConfig = simConfigs.get(id);
    if (!simConfig) return;
    simConfigs.delete(id);

    const simulation = simulations.get(id);
    if (simulation) {
      simulation.stop();
      simulations.delete(id);
    }

    console.log(`SimConfig deleted: ${id}`);
    configListStream.emit();
  }

  function list(): SimConfig[] {
    console.log('all:', simConfigs.values());
    return [...simConfigs.values()]
  }

  function simulationDataCollect(id: string) {
    const simulation = simulations.get(id);
    if (!simulation) throw new Error(`Simulation not found: ${id}`);
    return simulation.eventStream.collect();
  }

  function getSimulationData(id: string) {
    const simulation = simulations.get(id);
    if (!simulation) throw new Error(`Simulation not found: ${id}`);
    return simulation.eventStream.get();
  }


  const configListStream = createEventStream(() => [...simConfigs.keys()]);

  return {
    get, create, update, remove, list, configListStream,
    getSimulationData, simulationDataCollect
  };
}
