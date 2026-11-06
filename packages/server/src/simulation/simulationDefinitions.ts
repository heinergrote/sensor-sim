import {GeoPosition, Spec, SpecType} from "@sensor-sim/shared";
import {fixedDefinition} from "./definitions/fixed";
import {orbitDefinition} from "./definitions/orbit";
import {pathDefinition} from "./definitions/path";

export const defaultTarget = [10.523783, 52.264683] as const;


// Map SpecType -> Specific Internal State
type SimulationStateMap = {
  path: {
    currentDistance: number,
    position: GeoPosition;
  };
  orbit: {
    currentAngle: number,
    position: GeoPosition;
  };
  fixed: {
    position: GeoPosition;
  };
};

export type SimulationState<T extends SpecType = SpecType> = SimulationStateMap[T];

export interface SimulationDefinition<T extends SpecType> {
  // Default spec factory for fresh simulations, optional initial GeoPosition
  createDefaultSpec: (initialPosition?: GeoPosition) => Extract<Spec, { type: T }>;

  // Derived location calculation (e.g., center of orbit, centroid of path, or point position)
  getLocation: (spec: Extract<Spec, { type: T }>) => GeoPosition;

  // Initial state creator
  init: (spec: Extract<Spec, { type: T }>) => SimulationStateMap[T];

  // Pure state reducer
  step: (
    state: SimulationStateMap[T],
    spec: Extract<Spec, { type: T }>,
    deltaMs: number
  ) => SimulationStateMap[T];
}

const definitionRegistry = {
  fixed: fixedDefinition,
  orbit: orbitDefinition,
  path: pathDefinition
};

// Polymorphic Simulation API
export const simulationDefinitions = {
  getDefaultSpec: <T extends SpecType>(type: T, pos?: GeoPosition): Extract<Spec, { type: T }> => {
    return definitionRegistry[type].createDefaultSpec(pos) as Extract<Spec, { type: T }>;
  },

  getLocation: (spec: Spec): GeoPosition => {
    const def = definitionRegistry[spec.type] as SimulationDefinition<SpecType>;
    return def.getLocation(spec as any);
  },

  init: <S extends Spec>(spec: S): SimulationStateMap[S['type']] => {
    const def = definitionRegistry[spec.type] as SimulationDefinition<S['type']>;
    return def.init(spec as any);
  },

  step: <S extends Spec>(
    spec: S,
    state: SimulationStateMap[S['type']],
    deltaMs: number
  ): SimulationStateMap[S['type']] => {
    const def = definitionRegistry[spec.type] as SimulationDefinition<S['type']>;
    return def.step(state as any, spec as any, deltaMs);
  },

  // Helper to extract current GPS position from any state object
  getCurrentPosition: (state: SimulationState): GeoPosition => {
    return state.position;
  }
};