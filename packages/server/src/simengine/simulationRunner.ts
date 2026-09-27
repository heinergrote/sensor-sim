import {createEventStream} from "../util/eventStream";
import {getPosition} from "../util/geoCalc";
import {SimConfigDto, SimState} from "../types";

export type SimulationRunner = ReturnType<typeof createSimulationRunner>

export function createSimulationRunner(config: SimConfigDto) {

  let interval: NodeJS.Timeout | undefined;
  let lastTick = Date.now();

  const simState: SimState = {
    id: config.id,
    start: Date.now(),
    current: getPosition(
      {latitude: config.targetLatitude, longitude: config.targetLongitude},
      config.initialDistance, config.initialAzimuth
    ),
    distance: config.initialDistance,
    azimuth: config.initialAzimuth,
  }

  const simStateStream = createEventStream<SimState>();
  simStateStream.emit(() => simState);

  if (config.playing) start();


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

  function updateConfig(updateInput: SimConfigDto) {

    // apply new config
    config = {...config, ...updateInput};
    tick()

    if (config.playing) {
      start();
    } else {
      stop();
    }
  }

  //
  // function updateCurrent(position: PositionDto) {
  //   stop();
  //   sim.config.initialDistance = getDistance(
  //     {latitude: sim.config.targetLatitude, longitude: sim.config.targetLongitude},
  //     position);
  //   sim.config.initialAzimuth = getAzimuth(
  //     {latitude: sim.config.targetLatitude, longitude: sim.config.targetLongitude},
  //     position);
  //   start()
  // }
  //
  // function updatePlaying(playing: boolean) {
  //   stop();
  //   sim.config.playing = playing;
  //   if (playing) {
  //     start();
  //   }
  // }


  function start(reset: boolean = false) {
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

  return {
    simState, simStateStream, config, updateConfig, start, stop,
  };

}


