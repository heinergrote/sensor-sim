import * as turf from "@turf/turf";
import {point} from "@turf/turf";
import {GeoPosition} from "../types";

export function getPosition(origin: GeoPosition, distance: number, azimuth: number): GeoPosition {
  if (distance <= 0) {
    return origin;
  }
  const position = turf.destination(point([origin.longitude, origin.latitude]), distance, azimuth, {units: "meters"});
  return {
    longitude: position.geometry.coordinates[0],
    latitude: position.geometry.coordinates[1],
  };
}

export function getDistance(from: GeoPosition, to: GeoPosition): number {
  return turf.distance(
    point([from.longitude, from.latitude]),
    point([to.longitude, to.latitude]), {units: "meters"}
  );
}

export function getAzimuth(from: GeoPosition, to: GeoPosition): number {
  return turf.bearing(
    point([from.longitude, from.latitude]),
    point([to.longitude, to.latitude])
  );
}

export function randomOffset(origin: GeoPosition, minMeters: number, maxMeters: number): GeoPosition {
  const azimuth = Math.random() * 360;
  const distance = minMeters + Math.random() * (maxMeters - minMeters);
  return getPosition(origin, distance, azimuth);
}


export function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}