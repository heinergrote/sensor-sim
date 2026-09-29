import {SimulationRunner} from "./simengine/simulationRunner";
import {SimConfig, User} from "@sensor-sim/shared";


export type JWTPayload = {
  sub: number,
  username: string,
  admin: boolean,
  exp: number,
}

export type HonoGlobalVars = {
  user: User;
};

export type HonoSimRunnerVars = HonoGlobalVars & {
  simRunner: SimulationRunner,
};

export type HonoSimConfigsVars = HonoGlobalVars & {
  simConfig: SimConfig,
};


