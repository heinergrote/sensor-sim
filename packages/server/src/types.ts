import {SimulationRunner} from "./simengine/simulationRunner";
import {SimConfigDto, UserDto} from "./sharedTypes";


export type JWTPayload = {
  sub: number,
  username: string,
  admin: boolean,
  exp: number,
}

export type HonoGlobalVars = {
  user: UserDto;
};

export type HonoSimRunnerVars = HonoGlobalVars & {
  simRunner: SimulationRunner,
};

export type HonoSimConfigsVars = HonoGlobalVars & {
  simConfig: SimConfigDto,
};


