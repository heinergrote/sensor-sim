import type {SimConfig, SimState} from "@sensor-sim/shared";
import * as turf from "@turf/turf";
import {createEventStream} from "./eventStream";


export type Simulation = ReturnType<typeof createSimulation>

function createSimulation(simConfig: SimConfig) {

  const simState: SimState = {
    id: simConfig.id,
    start: Date.now(),
    current: simConfig.initial,
    distance: turf.distance(
      [simConfig.target.longitude, simConfig.target.latitude],
      [simConfig.initial.longitude, simConfig.initial.latitude],
      {units: "meters"}
    ),
  }

  const eventStream = createEventStream<{ simConfig: SimConfig, simState: SimState }>(() => ({
    simConfig,
    simState
  }));

  function updateConfig(data: Partial<SimConfig>) {
    const {id: _, ...rest} = data;
    Object.assign(simConfig, rest);
    tick()
  }


  function tick() {
    const {initial, target, speed, type} = simConfig;
    const {current, distance} = simState;

    const deltaMs = Date.now() - lastTick;
    lastTick = Date.now();

    const bearing = turf.bearing(
      [current.longitude, current.latitude],
      [target.longitude, target.latitude]
    )

    const currentDistance = turf.distance(
      [target.longitude, target.latitude],
      [current.longitude, current.latitude],
      {units: "meters"}
    )

    const stepDistance = speed * deltaMs / 1000;


    switch (type) {

      case "follow":
        if (currentDistance <= stepDistance) {
          // snap to target
          simState.current = {...target};
          simState.distance = 0;
        } else {

          const point = turf.destination(
            [current.longitude, current.latitude],
            stepDistance,
            bearing, {
              units: "meters"
            }
          );

          simState.current = {
            longitude: point.geometry.coordinates[0],
            latitude: point.geometry.coordinates[1]
          }
          simState.distance = currentDistance - stepDistance;
        }
        break;

      case "circle":

        if (currentDistance <= stepDistance) {
          // snap to target
          simState.current = {...target};
          simState.distance = 0;
        } else {

          // get the rotation angle from the step distance and radius distance
          const angle = (stepDistance / currentDistance) * (180 / Math.PI);

          const currentPoint = turf.point([current.longitude, current.latitude]);
          const point = turf.transformRotate(
            currentPoint,
            angle,
            {pivot: [target.longitude, target.latitude]}
          );

          simState.current = {
            longitude: point.geometry.coordinates[0],
            latitude: point.geometry.coordinates[1]
          }
          simState.distance = currentDistance - stepDistance;
        }
        break;
    }

    eventStream.emit();
  }


  let interval: NodeJS.Timeout | undefined;
  let lastTick = Date.now();

  function start() {

    stop()
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
    updateConfig,
    eventStream,
    start, stop
  };

}


export {createSimulation};


