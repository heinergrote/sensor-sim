import {SimulationDefinition} from "../simulationDefinitions";

export const fixedDefinition: SimulationDefinition<'fixed'> = {

  getLocation: spec => spec.position,

  init: (spec) => ({
    position: spec.position
  }),

  step: (state, _spec, _deltaMs) => {
    return {
      position: state.position
    };
  }
};