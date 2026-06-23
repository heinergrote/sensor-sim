export type Position = {
  latitude: number;
  longitude: number;
}


export type SimState = {
  target: Position,
  current: Position
}

export type ClientMsg = {
  type: 'setTarget';
  data: Position
}

export type ServerMsg = {
  type: 'state';
  data: SimState
}