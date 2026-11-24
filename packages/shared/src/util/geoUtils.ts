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


export function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export type BBox2D = [minLng: number, minLat: number, maxLng: number, maxLat: number];

/** Length in meters; 0 for a single-point (or empty) path. */
export function pathLength(path: readonly GeoPosition[]): number {
  if (path.length < 2) return 0;
  const mutablePath = path.map(position => [...position]); // turf assumes mutable arrays/coordinates
  return turf.length(turf.lineString(mutablePath), {units: "meters"});
}

export function getPositionOnPathByDistance(path: readonly GeoPosition[], distance: number): GeoPosition {
  assertNotEmpty(path);
  if (path.length < 2) return path[0];
  const mutablePath = path.map(position => [...position]); // turf assumes mutable arrays/coordinates
  const pos = turf.along(turf.lineString(mutablePath), distance, {units: 'meters'})
  return [pos.geometry.coordinates[0], pos.geometry.coordinates[1]]
}

export function getNearestPositionOnPath(path: readonly GeoPosition[], point: GeoPosition): {
  distance: number,
  position: GeoPosition
} {
  assertNotEmpty(path);
  if (path.length < 2) return {distance: 0, position: path[0]};

  const mutablePath = path.map(position => [...position]); // turf assumes mutable arrays/coordinates
  const mutablePoint = [...point];

  const snapped = turf.nearestPointOnLine(turf.lineString(mutablePath), mutablePoint, {units: 'meters'});
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

/** `[minLng, minLat, maxLng, maxLat]`; a single position yields a zero-size box. */
export function boundsOf(positions: readonly GeoPosition[]): BBox2D {
  assertNotEmpty(positions);
  if (positions.length < 2) {
    const [lng, lat] = positions[0];
    return [lng, lat, lng, lat];
  }
  const [minLng, minLat, maxLng, maxLat] = turf.bbox(turf.lineString(positions.map(position => [...position])));
  return [minLng, minLat, maxLng, maxLat];
}

/** Paths have at least one position (single-point paths are allowed); an empty one is a caller bug. */
function assertNotEmpty(path: readonly GeoPosition[]) {
  if (path.length === 0) throw new Error("path must contain at least one position");
}