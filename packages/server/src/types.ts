import {users} from "./db/schema";

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
  playing: boolean,
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

export type User = typeof users.$inferSelect;

export type JwtPayload = {
  sub: number,
  username: string,
  admin: boolean,
  exp: number,
}
