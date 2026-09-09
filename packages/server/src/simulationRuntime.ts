import type {SimConfig, Simulation} from "@sensor-sim/server";
import {createEventStream} from "./eventStream";
import {getDistanceAndAzimuth, getPosition} from "./util/getPosition";
import {SimConfigInput, SimUpdateCurrentInput, SimUpdateTargetInput} from "./trcp/appRouter";

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

  function configure(configInput: SimConfigInput) {
    const {id: _, ...newConfig} = configInput;

    sim.config = {...sim.config, ...newConfig};

    if (sim.config.playing) {
      start();
    } else {
      stop();
    }
  }

  function updateTarget(updateTargetInput: SimUpdateTargetInput) {
    sim.config.target = updateTargetInput.target;

    switch (sim.config.type) {
      case 'circle':
        // circle mode: simply restart with same initials
        start();
        break;
      case "follow":
        // follow mode: use current position to calculate new initial distance and azimuth
        if (sim.state) {
          const {current} = sim.state;
          const {distance, azimuth} = getDistanceAndAzimuth(sim.config.target, current);
          sim.config.initialDistance = distance;
          sim.config.initialAzimuth = azimuth;
          start()
        }
        break;
      default:
        break;
    }
  }

  function updateCurrent(updateCurrentInput: SimUpdateCurrentInput) {
    const {distance, azimuth} = getDistanceAndAzimuth(sim.config.target, updateCurrentInput.current);
    stop();
    sim.config.initialDistance = distance;
    sim.config.initialAzimuth = azimuth;
    start()
  }


  function start() {
    stop()

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
    sim, configure, updateTarget, updateCurrent,
    start, stop, simStream
  };

}


