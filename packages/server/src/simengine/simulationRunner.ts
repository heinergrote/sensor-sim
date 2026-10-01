import {createEventStream} from "../util/eventStream";
import {getPosition} from "@sensor-sim/shared/geoUtils";
import {SimConfig, SimData} from "@sensor-sim/shared";

export type SimulationRunner = ReturnType<typeof createSimulationRunner>

export function createSimulationRunner(config: SimConfig) {

  const simDataStream = createEventStream<SimData>();
  simDataStream.emit(currentSimData);

  let interval: NodeJS.Timeout | undefined;
  let lastTick = Date.now();

  let state = {
    distance: config.initialDistance,
    azimuth: config.initialAzimuth,
    position: getPosition(
      {latitude: config.targetLatitude, longitude: config.targetLongitude},
      config.initialDistance, config.initialAzimuth
    ),
  }

  function init() {
    state = {
      distance: config.initialDistance,
      azimuth: config.initialAzimuth,
      position: getPosition(
        {latitude: config.targetLatitude, longitude: config.targetLongitude},
        config.initialDistance, config.initialAzimuth
      ),
    }
  }

  function currentSimData(): SimData {
    return {
      position: state.position,
    }
  }

  init();
  if (config.playing) start();

  function updateState(deltaMs: number) {

    const {targetLatitude, targetLongitude, speed} = config;
    const stepDistance = speed * deltaMs / 1000;

    switch (config.type) {

      case "follow":
        if (state.distance <= stepDistance) {
          // snap to target
          state.position.longitude = targetLongitude;
          state.position.latitude = targetLatitude;
          state.distance = 0;
        } else {
          state.distance -= stepDistance;
          state.position = getPosition(
            {latitude: config.targetLatitude, longitude: config.targetLongitude},
            state.distance, state.azimuth
          )
        }
        break;

      case "circle":

        if (state.distance <= stepDistance) {
          // snap to target
          state.position.longitude = targetLongitude;
          state.position.latitude = targetLatitude;
          state.distance = 0;
        } else {
          // get the rotation angle from the step distance and radius distance
          const angle = (stepDistance / state.distance) * (180 / Math.PI);
          state.azimuth = (state.azimuth + angle) % 360;
          state.position = getPosition(
            {latitude: config.targetLatitude, longitude: config.targetLongitude},
            state.distance, state.azimuth
          )
        }
        break;
    }

  }

  function tick() {
    const now = Date.now();
    const deltaMs = now - lastTick;
    lastTick = now;
    updateState(deltaMs);
    simDataStream.emit(); // reemit the current state
  }

  function applySimConfig(newConfig: SimConfig) {

    type ConfigField = keyof SimConfig

    const relevantFields: ConfigField[] = ['type', 'playing', 'targetLatitude', 'targetLongitude', 'initialAzimuth', 'initialDistance', 'speed']
    const noRestartFields: ConfigField[] = ['type', 'speed']
    const restartFields: ConfigField[] = relevantFields.filter(field => !noRestartFields.includes(field))

    // check if config has changed
    const hasRelevantChanges = relevantFields.some(field => newConfig[field] !== config[field]);
    if (!hasRelevantChanges) {
      return;
    }

    // check if any fields require restart
    const requiresRestart = restartFields.some(field => newConfig[field] !== config[field]);
    if (requiresRestart) {
      stop()
    }

    // apply new config
    config = {...config, ...newConfig};

    if (config.playing && (requiresRestart || !interval)) {
      start();
    }

  }

  function start() {
    stop()
    lastTick = Date.now()
    init();

    if (!interval) {
      tick()
      interval = setInterval(() => {
        tick()
      }, 100);
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


