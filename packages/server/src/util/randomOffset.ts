import * as turf from "@turf/turf";

export function randomOffset(origin: { latitude: number; longitude: number }, minMeters: number, maxMeters: number) {
  const bearing = Math.random() * 360;
  const distance = minMeters + Math.random() * (maxMeters - minMeters);
  const point = turf.destination(
    [origin.longitude, origin.latitude],
    distance,
    bearing,
    {units: "meters"}
  );
  return {
    longitude: point.geometry.coordinates[0],
    latitude: point.geometry.coordinates[1],
  };
}