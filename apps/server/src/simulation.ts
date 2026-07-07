import type {Position, SimState} from "@sensor-sim/shared";
import * as turf from "@turf/turf";

export type Simulation = ReturnType<typeof createSimulation>;

function createSimulation(id: string) {

  const simState: SimState = {
    target: {latitude: 52.264683, longitude: 10.523783},
    type: "follow",
    speed: 10,
    current: {latitude: 52.264683, longitude: 10.523783},
    distance: 0,
  };

  const listeners = new Set<(state: SimState) => void>();

  function addListener(listener: (state: SimState) => void) {
    listeners.add(listener);
  }

  function notifyListeners() {
    for (const listener of listeners) listener(simState);
  }

  function removeListener(listener: (state: SimState) => void) {
    listeners.delete(listener);
  }

  function nextUpdate(): Promise<SimState> {
    return new Promise(resolve => {
      const triggerListener = (state: SimState) => {
        removeListener(triggerListener);
        resolve(state);
      };
      addListener(triggerListener);
    });
  }


  function setTarget(pos: Position) {
    simState.target = pos;
    tick()
    return simState
  }

  function setCurrent(pos: Position) {
    simState.current = pos;
    tick()
    return simState
  }

  function setType(type: "follow" | "circle") {
    simState.type = type;
    tick()
    return simState
  }

  function setSpeed(speed: number) {
    simState.speed = speed;
    tick()
    return simState
  }

  function tick() {
    const {target, speed, current} = simState;

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


    switch (simState.type) {

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


    notifyListeners();
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
    id, simState,
    addListener, removeListener, nextUpdate,
    setTarget, setCurrent, setType, setSpeed,
    start, stop
  };

}


export {createSimulation};


