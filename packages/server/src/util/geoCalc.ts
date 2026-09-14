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

export function getDistance(from: Position, to: Position): number {
  return turf.distance(
    point([from.longitude, from.latitude]),
    point([to.longitude, to.latitude]), {units: "meters"}
  );
}

export function getAzimuth(from: Position, to: Position): number {
  return turf.bearing(
    point([from.longitude, from.latitude]),
    point([to.longitude, to.latitude])
  );
}



