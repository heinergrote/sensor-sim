export type Position = {
  latitude: number;
  longitude: number;
}

export type SimConfig = {
  id: string,
  target: Position,
  initial: Position,
  type: "follow" | "circle",
  speed: number,
}

export type SimState = {
  id: string,
  start: number,
  current: Position,
  distance: number,
}
