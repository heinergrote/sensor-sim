import type {Position} from "@sensor-sim/shared";
import * as turf from "@turf/turf";
import {point} from "@turf/turf";

export function getPosition(origin: Position, distance: number, azimuth: number): Position {
  const position = turf.destination(point([origin.longitude, origin.latitude]), distance, azimuth, {units: "meters"});
  return {
    longitude: position.geometry.coordinates[0],
    latitude: position.geometry.coordinates[1],
  };
}