import {GeoPosition} from "@sensor-sim/shared";
import {randomOffset} from "@sensor-sim/shared/geoUtils";
import {defaultTarget, SimulationDefinition} from "../simulationDefinitions";

export const fixedDefinition: SimulationDefinition<'fixed'> = {

  createDefaultSpec: (initialPosition?: GeoPosition) => {
    if (!initialPosition)
      initialPosition = randomOffset(defaultTarget, 0, 500);

    return {
      type: "fixed",
      latitude: initialPosition.latitude,
      longitude: initialPosition.longitude,
    };
  },

  getLocation: (spec) => ({
    latitude: spec.latitude,
    longitude: spec.longitude
  }),

  init: (spec) => ({
    position: {latitude: spec.latitude, longitude: spec.longitude}
  }),

  step: (state, _spec, _deltaMs) => {
    return {
      position: state.position
    };
  }
};