import {createEventStream} from "../util/eventStream";
import {SimConfig, SimData} from "@sensor-sim/shared";
import {isDeepStrictEqual} from "node:util";
import {simulationDefinitions, SimulationState} from "./simulationDefinitions";

export type SimulationRunner = ReturnType<typeof createSimulationRunner>

export function createSimulationRunner(config: SimConfig) {

  const simDataStream = createEventStream<SimData>();
  simDataStream.emit(currentSimData);

  let interval: NodeJS.Timeout | undefined;
  let lastTick = Date.now();

  let state: SimulationState | null = null
  if (config.spec) state = simulationDefinitions.init(config.spec)

  function currentSimData(): SimData {
    return {
      position: state ? simulationDefinitions.getCurrentPosition(state) : {
        latitude: 0,
        longitude: 0,
      },
    }
  }

  if (config.playing) start();


  function tick() {
    const now = Date.now();
    const deltaMs = now - lastTick;
    lastTick = now;

    // produce the next state
    if (config.spec && state)
      state = simulationDefinitions.step(config.spec, state, deltaMs)

    simDataStream.emit(); // reemit the current state
  }

  function applySimConfig(newConfig: SimConfig) {

    type ConfigField = keyof SimConfig

    const relevantFields: ConfigField[] = ['spec', 'playing']

    // check if config has changed. make a deep compare using nodes isDeepStrictEqual
    const hasRelevantChanges = relevantFields.some(field => !isDeepStrictEqual(newConfig[field], config[field]));
    if (!hasRelevantChanges) {
      return;
    }

    stop()
    // apply new config
    config = {...config, ...newConfig};

    if (config.playing) start();

  }

  function start() {
    stop()
    lastTick = Date.now()
    if (config.spec) state = simulationDefinitions.init(config.spec)

    if (!interval) {
      tick()
      interval = setInterval(tick, 100);
    }
  }

  function stop() {
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
  }

  function dispose() {
    stop()
    simDataStream.close()
  }

  return {
    get simData() {
      return currentSimData()
    },
    get config() {
      return config
    },
    simDataStream, applySimConfig, start, stop, dispose
  };

}


