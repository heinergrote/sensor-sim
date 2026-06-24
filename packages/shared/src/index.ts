export type Position = {
  latitude: number;
  longitude: number;
}

export type SimState = {
  target: Position,
  current: Position,
  distance: number,
}
