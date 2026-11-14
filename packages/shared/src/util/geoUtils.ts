import * as turf from "@turf/turf";
import {lineString} from "@turf/turf";
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


export function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function pathLength(path: readonly GeoPosition[]): number {
  const mutablePath = path.map(position => [...position]); // turf assumes mutable arrays/coordinates
  return turf.length(lineString(mutablePath), {units: "meters"});
}

export function getPositionOnPathByDistance(path: readonly GeoPosition[], distance: number): GeoPosition {
  const mutablePath = path.map(position => [...position]); // turf assumes mutable arrays/coordinates
  const pos = turf.along(lineString(mutablePath), distance, {units: 'meters'})
  return [pos.geometry.coordinates[0], pos.geometry.coordinates[1]]
}

export function getNearestPositionOnPath(path: readonly GeoPosition[], point: GeoPosition): {
  distance: number,
  position: GeoPosition
} {
  const mutablePath = path.map(position => [...position]); // turf assumes mutable arrays/coordinates
  const mutablePoint = [...point];

  const snapped = turf.nearestPointOnLine(lineString(mutablePath), mutablePoint, {units: 'meters'});
  const distance = snapped.properties.totalDistance;
  const pos = snapped.geometry.coordinates;

  return {
    distance,
    position: Object.freeze([pos[0], pos[1]]),
  }

}


export function randomOffset(origin: GeoPosition, minMeters: number, maxMeters: number): GeoPosition {
  const azimuth = Math.random() * 360;
  const distance = minMeters + Math.random() * (maxMeters - minMeters);
  return getPosition(origin, distance, azimuth);
}