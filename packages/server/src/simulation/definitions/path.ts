import {GeoPosition} from "@sensor-sim/shared";
import {getAzimuth, getDistance, getPosition, randomBetween, randomOffset} from "@sensor-sim/shared/geoUtils";
import {defaultTarget, SimulationDefinition} from "../simulationDefinitions";

export const pathDefinition: SimulationDefinition<'path'> = {

  createDefaultSpec: (initialPosition?: GeoPosition) => {
    if (!initialPosition)
      initialPosition = randomOffset(defaultTarget, 0, 500);
    const randomStart = randomOffset(initialPosition, 50, 200);

    return {
      type: "path",
      target: initialPosition,
      start: randomStart,
      speed: Math.round(randomBetween(5, 20)),
    };
  },

  getLocation: spec => spec.start,

  init: (spec) => ({
    currentDistance: getDistance(spec.target, spec.start,),
    position: spec.start
  }),

  step: (state, spec, deltaMs) => {
    const stepDistance = spec.speed * deltaMs / 1000;
    const azimuth = getAzimuth(spec.target, spec.start,)
    const nextDistance = Math.max(0, state.currentDistance - stepDistance);
    const nextPosition = getPosition(spec.target, nextDistance, azimuth)
    return {
      currentDistance: nextDistance,
      position: nextPosition
    };
  }
};