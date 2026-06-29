import type {Position, SimState} from "@sensor-sim/shared";
import * as turf from "@turf/turf";

const speed = 10; // meter/second

export type Sim = ReturnType<typeof createSimulation>;

function createSimulation(id: string) {

  const simState: SimState = {
    target: {latitude: 52.264683, longitude: 10.523783},
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


  let interval: NodeJS.Timeout | undefined;
  let lastTick = Date.now();

  function start() {

    stop()
    lastTick = Date.now();

    interval = setInterval(() => {
      tick()
    }, 500);

  }

  function stop() {
    if (!interval) return;
    clearInterval(interval);
  }


  return {
    id, simState,
    addListener, removeListener,
    nextUpdate, setTarget, setCurrent, start, stop
  };

}

const registry = new Map<string, Sim>();

function getSim(id: string, createIfNotExists = false): Sim | never {
  if (!registry.has(id) && createIfNotExists)
    return createSim(id);
  const sim = registry.get(id);
  if (!sim) throw new Error(`Sim ${id} not found`);
  return sim;
}

function createSim(id: string) {
  if (registry.has(id)) throw new Error(`Sim ${id} already exists`);
  const sim = createSimulation(id);
  sim.start();
  registry.set(id, sim);
  console.log(`Sim created: ${id}`);
  return sim;
}

function deleteSim(id: string) {
  const sim = registry.get(id);
  if (!sim) return;
  sim.stop();
  registry.delete(id);
  console.log(`Sim deleted: ${id}`);
}

function listSims(): { id: string, simState: SimState }[] {
  return Array.from(
    registry.values().map((sim) => ({
        id: sim.id,
        simState: sim.simState,
      })
    )
  );
}

export {createSimulation, createSim, getSim, listSims, deleteSim};


