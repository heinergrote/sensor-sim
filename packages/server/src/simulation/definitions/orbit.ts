import {getPosition, randomBetween, randomOffset} from "@sensor-sim/shared/geoUtils";
import {GeoPosition} from "@sensor-sim/shared";
import {defaultTarget, SimulationDefinition} from "../simulationDefinitions";

export const orbitDefinition: SimulationDefinition<'orbit'> = {

  createDefaultSpec: (initialPosition?: GeoPosition) => {
    if (!initialPosition)
      initialPosition = randomOffset(defaultTarget, 0, 500);

    return {
      type: 'orbit',
      center: initialPosition,
      radius: randomBetween(50, 200),
      startAngle: randomBetween(0, 360),
      speed: Math.round(randomBetween(5, 20)),
    }
  },

  getLocation: spec => spec.center,

  init: (spec) => ({
    currentAngle: spec.startAngle,
    position: getPosition(spec.center, spec.radius, spec.startAngle)
  }),

  step: (state, spec, deltaMs) => {
    const stepDistance = spec.speed * deltaMs / 1000;

    // get the rotation angle from the step distance and radius distance
    const angle = (stepDistance / spec.radius) * (180 / Math.PI);
    const nextAngle = (state.currentAngle + angle) % 360;
    const nextPosition = getPosition(spec.center, spec.radius, nextAngle)

    return {
      currentAngle: nextAngle,
      position: nextPosition
    };
  }
};