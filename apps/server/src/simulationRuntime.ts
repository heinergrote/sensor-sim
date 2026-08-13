import type {SimConfig, Simulation} from "@sensor-sim/shared";
import {createEventStream} from "./eventStream";
import {getPosition} from "./util/getPosition";
import {SimConfigInput} from "./trcp/appRouter";

export type SimulationRuntime = ReturnType<typeof createSimulationRuntime>

export function createSimulationRuntime(baseConfig: SimConfig) {

  let interval: NodeJS.Timeout | undefined;
  let lastTick = Date.now();

  const sim: Simulation = {
    config: {...baseConfig},
    state: null,
  }

  const simStream = createEventStream<Simulation>(() => sim);

  function updateState(deltaMs: number) {
    if (sim.state) {

      const {target, speed} = sim.config;

      // const bearing = turf.bearing(
      //   [current.longitude, current.latitude],
      //   [target.longitude, target.latitude]
      // )

      // const currentDistance = turf.distance(
      //   [target.longitude, target.latitude],
      //   [current.longitude, current.latitude],
      //   {units: "meters"}
      // )

      const stepDistance = speed * deltaMs / 1000;

      switch (sim.config.type) {

        case "follow":
          if (sim.state.distance <= stepDistance) {
            // snap to target
            sim.state.current = {...target};
            sim.state.distance = 0;
          } else {
            sim.state.distance -= stepDistance;
            sim.state.current = getPosition(
              sim.config.target,
              sim.state.distance,
              sim.state.azimuth
            )
          }
          break;

        case "circle":

          if (sim.state.distance <= stepDistance) {
            // snap to target
            sim.state.current = {...target};
            sim.state.distance = 0;
          } else {
            // get the rotation angle from the step distance and radius distance
            const angle = (stepDistance / sim.state.distance) * (180 / Math.PI);
            sim.state.azimuth = (sim.state.azimuth + angle) % 360;
            sim.state.current = getPosition(
              sim.config.target,
              sim.state.distance,
              sim.state.azimuth
            )
          }
          break;
      }
    }

  }

  function tick() {
    const now = Date.now();
    const deltaMs = now - lastTick;
    lastTick = now;
    updateState(deltaMs);
    simStream.emit();
  }

  function start(newConfig?: SimConfigInput) {
    stop()

    if (newConfig) {
      const {id: _, ...rest} = newConfig;
      sim.config = {...sim.config, ...rest};
    }
    // initial state
    sim.state = {
      id: sim.config.id,
      start: Date.now(),
      current: getPosition(sim.config.target, sim.config.initialDistance, sim.config.initialAzimuth),
      distance: sim.config.initialDistance,
      azimuth: sim.config.initialAzimuth,
    }
    tick()

    interval = setInterval(() => {
      tick()
    }, 100);
  }

  function stop() {
    if (!interval) return;
    sim.state = null;
    clearInterval(interval);
    simStream.emit();
  }

  return {
    sim,
    start, stop, simStream
  };

}


