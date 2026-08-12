import type {Position, SimConfig, SimState} from "@sensor-sim/shared";
import * as turf from "@turf/turf";
import {point} from "@turf/turf";
import {createEventStream} from "./eventStream";

export type Simulation = ReturnType<typeof createSimulation>


export function getPosition(origin: Position, distance: number, azimuth: number): Position {
  const position = turf.destination(point([origin.longitude, origin.latitude]), distance, azimuth, {units: "meters"});
  return {
    longitude: position.geometry.coordinates[0],
    latitude: position.geometry.coordinates[1],
  };
}

function createSimulation(id: string) {

  let interval: NodeJS.Timeout | undefined;
  let lastTick = Date.now();

  let config: SimConfig | null = null;
  let state: SimState | null = null;

  const simulationDataStream = createEventStream<{ simConfig: SimConfig | null, simState: SimState | null }>(
    () => ({simConfig: config, simState: state,})
  );

  function update(deltaMs: number) {
    if (!config || !state) return;

    const {target, initialDistance, initialAzimuth, speed, type} = config;
    const {current} = state;

    const bearing = turf.bearing(
      [current.longitude, current.latitude],
      [target.longitude, target.latitude]
    )

    // const currentDistance = turf.distance(
    //   [target.longitude, target.latitude],
    //   [current.longitude, current.latitude],
    //   {units: "meters"}
    // )

    const stepDistance = speed * deltaMs / 1000;

    switch (type) {

      case "follow":
        if (state.distance <= stepDistance) {
          // snap to target
          state.current = {...target};
          state.distance = 0;
        } else {
          state.distance -= stepDistance;
          state.current = getPosition(config.target, state.distance, state.azimuth)
        }
        break;

      case "circle":

        if (state.distance <= stepDistance) {
          // snap to target
          state.current = {...target};
          state.distance = 0;
        } else {
          // get the rotation angle from the step distance and radius distance
          const angle = (stepDistance / state.distance) * (180 / Math.PI);
          state.azimuth = (state.azimuth + angle) % 360;
          state.current = getPosition(config.target, state.distance, state.azimuth)
        }
        break;
    }

    simulationDataStream.emit();
  }

  function tick() {
    const now = Date.now();
    const deltaMs = now - lastTick;
    lastTick = now;
    update(deltaMs);
  }

  function start(simConfig: SimConfig) {
    stop()

    config = {...simConfig};
    state = {
      id: id,
      start: Date.now(),
      current: getPosition(config.target, config.initialDistance, config.initialAzimuth),
      distance: config.initialDistance,
      azimuth: config.initialAzimuth,
    }
    lastTick = Date.now();
    interval = setInterval(() => {
      tick()
    }, 100);
  }

  function stop() {
    if (!interval) return;
    clearInterval(interval);
  }

  return {
    start, stop, simulationDataStream
  };

}


export {createSimulation};


