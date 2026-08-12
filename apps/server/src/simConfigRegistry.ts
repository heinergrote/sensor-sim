import {SimConfig} from "@sensor-sim/shared";
import * as turf from "@turf/turf";
import {SimConfigInput} from "./trcp/appRouter";
import {createEventStream} from "./eventStream";
import {SimulationRegistry} from "./simulationRegistry";

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

export function createSimRegistry(simulationRegistry: SimulationRegistry) {

  const simConfigs = new Map<string, SimConfig>();

  function get(id: string, createIfNotExists = false): SimConfig | never {
    if (!simConfigs.has(id) && createIfNotExists)
      return create({id, type: "follow"});
    const simConfig = simConfigs.get(id);
    if (!simConfig) throw new Error(`Sim ${id} not found`);
    return simConfig;
  }

  function create(data: SimConfigInput) {
    if (simConfigs.has(data.id)) throw new Error(`Sim ${data.id} already exists`);

    const target = data.target ? data.target : randomOffset(defaultTarget, 200, 300);
    const initialDistance = data.initialDistance ? data.initialDistance : Math.random() * 50 + 60;
    const initialAzimuth = data.initialAzimuth ? data.initialAzimuth : Math.random() * 360;
    const type = data.type ? data.type : "follow";
    const speed = data.speed ? data.speed : 20;

    const simConfig: SimConfig = {
      id: data.id,
      target: target,
      initialDistance: initialDistance,
      initialAzimuth: initialAzimuth,
      type: type,
      speed: speed,
    };

    simConfigs.set(data.id, simConfig);

    simulationRegistry.create(simConfig);

    configListStream.emit();

    return simConfig;
  }

  function update(data: SimConfigInput) {
    const simConfig = get(data.id, true);
    if (data.type) simConfig.type = data.type;
    if (data.initialDistance) simConfig.initialDistance = data.initialDistance;
    if (data.initialAzimuth) simConfig.initialAzimuth = data.initialAzimuth;
    if (data.target) simConfig.target = {latitude: data.target.latitude, longitude: data.target.longitude};
    if (data.speed) simConfig.speed = data.speed;

    simulationRegistry.update(simConfig);

    return simConfig
  }

  function remove(id: string) {
    const simConfig = simConfigs.get(id);
    if (!simConfig) return;
    simConfigs.delete(id);

    simulationRegistry.remove(id);

    configListStream.emit();
  }

  function list(): SimConfig[] {
    return [...simConfigs.values()]
  }

  const configListStream = createEventStream(() => [...simConfigs.keys()]);

  return {
    get, create, update, remove, list, configListStream
  };
}
