import type {Position, SimState} from "@sensor-sim/shared";
import * as turf from "@turf/turf";

const simState: SimState = {
  target: {latitude: 52.264683, longitude: 10.523783},
  current: {latitude: 52.264683, longitude: 10.523783},
  distance: 0,
};

const listeners = new Set<(state: SimState) => void>();

function notifyListeners() {
  for (const listener of listeners) listener(simState);
}

function nextSimStateUpdate(): Promise<SimState> {
  return new Promise(resolve => {
    const triggerListener = (state: SimState) => {
      listeners.delete(triggerListener);
      resolve(state);
    };
    listeners.add(triggerListener);
  });
}

const speed = 10; // meter/second

let interval: NodeJS.Timeout
let lastTick = Date.now();

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


function tick() {
  const {target, current} = simState;

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


  notifyListeners();
}


function startSimulation() {

  stopSimulation()

  interval = setInterval(() => {
    tick()
  }, 100);

}

function stopSimulation() {
  if (!interval) return;
  clearInterval(interval);
}


export {simState, setTarget, setCurrent, startSimulation, stopSimulation, nextSimStateUpdate};


