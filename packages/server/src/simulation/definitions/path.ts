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
      targetLatitude: initialPosition.latitude,
      targetLongitude: initialPosition.longitude,
      startLatitude: randomStart.latitude,
      startLongitude: randomStart.longitude,
      speed: Math.round(randomBetween(5, 20)),
    };
  },

  getLocation: (spec) => ({
    latitude: spec.targetLatitude,
    longitude: spec.targetLongitude
  }),

  init: (spec) => ({
    currentDistance: getDistance(
      {latitude: spec.targetLatitude, longitude: spec.targetLongitude},
      {latitude: spec.startLatitude, longitude: spec.startLongitude},
    ),
    position: {latitude: spec.startLatitude, longitude: spec.startLongitude}
  }),

  step: (state, spec, deltaMs) => {
    const stepDistance = spec.speed * deltaMs / 1000;
    const azimuth = getAzimuth(
      {latitude: spec.targetLatitude, longitude: spec.targetLongitude},
      {latitude: spec.startLatitude, longitude: spec.startLongitude},
    )
    const nextDistance = Math.max(0, state.currentDistance - stepDistance);
    const nextPosition = getPosition(
      {latitude: spec.targetLatitude, longitude: spec.targetLongitude},
      nextDistance, azimuth
    )

    return {
      currentDistance: nextDistance,
      position: nextPosition
    };
  }
};