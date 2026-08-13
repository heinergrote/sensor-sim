export type Position = {
  latitude: number;
  longitude: number;
}

export type SimConfig = {
  id: string,
  target: Position,
  initialDistance: number,
  initialAzimuth: number,
  type: "follow" | "circle",
  speed: number,
}

export type SimState = {
  id: string,
  start: number,
  current: Position,
  distance: number,
  azimuth: number,
}

export type Simulation = {
  config: SimConfig,
  state: SimState | null,
}

