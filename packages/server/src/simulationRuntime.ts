import type {SimConfig, Simulation} from "@sensor-sim/server";
import {createEventStream} from "./util/eventStream";
import {PositionInput, SimConfigInput} from "./zodSchema";
import {getAzimuth, getDistance, getPosition} from "./util/geoCalc";

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

    if (!sim.state) {

      // set initial state
      sim.state = {
        id: sim.config.id,
        start: Date.now(),
        current: getPosition(sim.config.target, sim.config.initialDistance, sim.config.initialAzimuth),
        distance: sim.config.initialDistance,
        azimuth: sim.config.initialAzimuth,
      }

    }

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

  function tick() {
    const now = Date.now();
    const deltaMs = now - lastTick;
    lastTick = now;
    updateState(deltaMs);
    simStream.emit();
  }

  function update(updateInput: SimConfigInput) {
    // remove id

    // apply new config
    sim.config = {...sim.config, ...updateInput};

    // for follow type: infer initial distance and azimuth from current position, if available
    if (sim.config.type === "follow" && sim.state) {
      if (!updateInput.initialDistance) {
        sim.config.initialDistance = getDistance(sim.config.target, sim.state.current);
      }
      if (!updateInput.initialAzimuth) {
        sim.config.initialAzimuth = getAzimuth(sim.config.target, sim.state.current);
      }
    }

    sim.state = null;
    tick()

    if (sim.config.playing) {
      start();
    } else {
      stop();
    }
  }

  function updateCurrent(position: PositionInput) {
    stop();
    sim.config.initialDistance = getDistance(sim.config.target, position);
    sim.config.initialAzimuth = getAzimuth(sim.config.target, position);
    start()
  }


  function start(reset: boolean = false) {
    if (reset) {
      sim.state = null;
    }
    if (!interval) {
      tick()
      interval = setInterval(() => {
        tick()
      }, 100);
    }
  }


  function stop() {
    sim.state = null;
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
    simStream.emit();
  }

  return {
    sim, update, updateCurrent,
    start, stop, simStream
  };

}


