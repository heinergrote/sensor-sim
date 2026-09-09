import type {Position} from "@sensor-sim/server";
import * as turf from "@turf/turf";
import {point} from "@turf/turf";

export function getPosition(origin: Position, distance: number, azimuth: number): Position {
  const position = turf.destination(point([origin.longitude, origin.latitude]), distance, azimuth, {units: "meters"});
  return {
    longitude: position.geometry.coordinates[0],
    latitude: position.geometry.coordinates[1],
  };
}

export function getDistanceAndAzimuth(from: Position, to: Position): { distance: number, azimuth: number } {
  const distance = turf.distance(
    point([from.longitude, from.latitude]),
    point([to.longitude, to.latitude]), {units: "meters"}
  );
  const azimuth = turf.bearing(
    point([from.longitude, from.latitude]),
    point([to.longitude, to.latitude])
  );
  return {
    distance,
    azimuth,
  };
}


