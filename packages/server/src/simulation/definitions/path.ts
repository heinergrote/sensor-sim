import {GeoPosition, SpecPath} from "@sensor-sim/shared";
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
      editMode: "linestring",
      playMode: "single",
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
    // total distance travelled since start (odometer); for loop/reversing it keeps growing
    const nextDistance = state.travelledDistance + spec.speed * deltaMs / 1000;
    const length = pathLength(spec.waypoints);
    const {offset, remaining} = positionOnPass(spec.playMode, length, nextDistance);

    return {
      distanceFromTarget: getDistance(spec.waypoints[0], spec.waypoints[spec.waypoints.length - 1]),
      travelledDistance: nextDistance,
      remainingDistance: remaining,
      position: getPositionOnPathByDistance(spec.waypoints, offset)
    };
  }
};

/**
 * Maps the total travelled distance to an offset along the path (from its first waypoint) and the
 * distance remaining in the current pass (to the end for single/loop, to the next turn for reversing).
 */
function positionOnPass(playMode: SpecPath["playMode"], length: number, travelled: number) {
  if (length <= 0) return {offset: 0, remaining: 0};

  switch (playMode) {
    case "loop": {
      // jump back to the first waypoint after reaching the last one
      const offset = travelled % length;
      return {offset, remaining: length - offset};
    }
    case "reversing": {
      // one period = there and back again
      const t = travelled % (2 * length);
      return t <= length
        ? {offset: t, remaining: length - t}
        : {offset: 2 * length - t, remaining: 2 * length - t};
    }
    case "single":
    default:
      // turf.along clamps at the last waypoint
      return {offset: travelled, remaining: length - travelled};
  }
}
