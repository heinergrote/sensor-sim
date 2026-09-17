import {simConfigs, users} from "./db/schema";

export type Position = {
  latitude: number;
  longitude: number;
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

export type SimConfig = typeof simConfigs.$inferSelect;
export type User = typeof users.$inferSelect;


export type JwtPayload = {
  sub: number,
  username: string,
  admin: boolean,
  exp: number,
}
