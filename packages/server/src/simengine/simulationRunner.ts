import {createEventStream} from "../util/eventStream";
import {getPosition} from "../util/geoCalc";
import {SimConfigDto, SimState} from "../sharedTypes";

export type SimulationRunner = ReturnType<typeof createSimulationRunner>

export function createSimulationRunner(config: SimConfigDto) {

  let simState: SimState = initialState();

  let interval: NodeJS.Timeout | undefined;
  let lastTick = Date.now();

  const simStateStream = createEventStream<SimState>();
  simStateStream.emit(() => simState);

  if (config.playing) start();


  function initialState(): SimState {
    return {
      id: config.id,
      start: Date.now(),
      current: getPosition(
        {latitude: config.targetLatitude, longitude: config.targetLongitude},
        config.initialDistance, config.initialAzimuth
      ),
      distance: config.initialDistance,
      azimuth: config.initialAzimuth,
    }
  }

  function updateState(deltaMs: number) {

    const {targetLatitude, targetLongitude, speed} = config;
    const stepDistance = speed * deltaMs / 1000;

    switch (config.type) {

      case "follow":
        if (simState.distance <= stepDistance) {
          // snap to target
          simState.current.longitude = targetLongitude;
          simState.current.latitude = targetLatitude;
          simState.distance = 0;
        } else {
          simState.distance -= stepDistance;
          simState.current = getPosition(
            {latitude: config.targetLatitude, longitude: config.targetLongitude},
            simState.distance, simState.azimuth
          )
        }
        break;

      case "circle":

        if (simState.distance <= stepDistance) {
          // snap to target
          simState.current.longitude = targetLongitude;
          simState.current.latitude = targetLatitude;
          simState.distance = 0;
        } else {
          // get the rotation angle from the step distance and radius distance
          const angle = (stepDistance / simState.distance) * (180 / Math.PI);
          simState.azimuth = (simState.azimuth + angle) % 360;
          simState.current = getPosition(
            {latitude: config.targetLatitude, longitude: config.targetLongitude},
            simState.distance, simState.azimuth
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
    simStateStream.emit(); // reemit the current state
  }

  function applySimConfig(newConfig: SimConfigDto) {

    type ConfigField = keyof SimConfigDto

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
    simState = initialState();

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
    simStateStream.close()
  }

  return {
    get simState() {
      return simState
    },
    get config() {
      return config
    },
    simStateStream, applySimConfig, start, stop, dispose
  };

}


