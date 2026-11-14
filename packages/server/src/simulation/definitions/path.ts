import {GeoPosition} from "@sensor-sim/shared";
import {
  getDistance,
  getPositionOnPathByDistance,
  pathLength,
  randomBetween,
  randomOffset
} from "@sensor-sim/shared/geoUtils";
import {defaultTarget, SimulationDefinition} from "../simulationDefinitions";

export const pathDefinition: SimulationDefinition<'path'> = {

  createDefaultSpec: (initialPosition?: GeoPosition) => {
    if (!initialPosition)
      initialPosition = randomOffset(defaultTarget, 0, 500);
    const waypoint = randomOffset(initialPosition, 50, 200);

    return {
      type: "path",
      waypoints: [initialPosition, waypoint],
      speed: Math.round(randomBetween(5, 20)),
    };
  },

  getLocation: spec => spec.waypoints[0],

  init: (spec) => ({
    distanceFromTarget: getDistance(spec.waypoints[0], spec.waypoints[spec.waypoints.length - 1]),
    travelledDistance: 0,
    remainingDistance: pathLength(spec.waypoints),
    position: spec.waypoints[0]
  }),

  step: (state, spec, deltaMs) => {
    const nextDistance = state.travelledDistance + spec.speed * deltaMs / 1000;

    // move along the path defined by the waypoints
    const nextPosition = getPositionOnPathByDistance(spec.waypoints, nextDistance);

    return {
      distanceFromTarget: getDistance(spec.waypoints[0], spec.waypoints[spec.waypoints.length - 1]),
      travelledDistance: nextDistance,
      remainingDistance: pathLength(spec.waypoints) - nextDistance,
      position: nextPosition
    };
  }
};