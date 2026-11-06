import {GeoPosition} from "@sensor-sim/shared";
import {randomOffset} from "@sensor-sim/shared/geoUtils";
import {defaultTarget, SimulationDefinition} from "../simulationDefinitions";

export const fixedDefinition: SimulationDefinition<'fixed'> = {

  createDefaultSpec: (position?: GeoPosition) => {
    if (!position)
      position = randomOffset(defaultTarget, 0, 500);

    return {
      type: "fixed",
      position: position
    };
  },

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