export type Position = {
  latitude: number;
  longitude: number;
}

export type SimState = {
  target: Position,
  type: "follow" | "circle",
  speed: number,
  current: Position,
  distance: number,
}

export type SimulationData = {
  id: string,
  simState: SimState,
}