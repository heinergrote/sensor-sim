import {simConfigs, users} from "./db/schema";
import {EventStream} from "./util/eventStream";

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

export type Status = {
  startedAt: number,
  simListUpdatedAt: number,
  numSims: number,
}

export type SimConfig = typeof simConfigs.$inferSelect;
export type User = typeof users.$inferSelect;


export type JWTPayload = {
  sub: number,
  username: string,
  admin: boolean,
  exp: number,
}

export type Profile = {
  id: number,
  username: string,
  exp: number,
  admin: boolean,
}


export type HonoEnv = {
  Variables: {
    jwtPayload: JWTPayload;
    sim: Simulation,
    simStream: EventStream<Simulation>
  };
};
