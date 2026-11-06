import * as turf from "@turf/turf";
import {GeoPosition} from "../types";

export function getPosition(origin: GeoPosition, distance: number, azimuth: number): GeoPosition {

  if (distance <= 0) {
    return origin;
  }
  const position = turf.destination([...origin], distance, azimuth, {units: "meters"});
  return [position.geometry.coordinates[0], position.geometry.coordinates[1]]
}

export function getDistance(from: GeoPosition, to: GeoPosition): number {
  return turf.distance([...from], [...to], {units: "meters"});
}

export function getAzimuth(from: GeoPosition, to: GeoPosition): number {
  return turf.bearing([...from], [...to]);
}

export function randomOffset(origin: GeoPosition, minMeters: number, maxMeters: number): GeoPosition {
  const azimuth = Math.random() * 360;
  const distance = minMeters + Math.random() * (maxMeters - minMeters);
  return getPosition(origin, distance, azimuth);
}


export function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}