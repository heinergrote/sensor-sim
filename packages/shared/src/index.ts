export type SimState = {
  latitude: number;
  longitude: number;
  altitude: number;
}

export type ClientMsg = {
  type: 'setState';
  data: Partial<SimState>
}

export type ServerMsg = {
  type: 'state';
  data: SimState
}