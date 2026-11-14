import {createContext} from "solid-js";
import type {MapLibreMap} from "maplibre-gl";

/** The loaded map, or `undefined` while it is (re)created. Provided by `SimList`, set by `SimMap`. */
export const MapContext = createContext<() => MapLibreMap | undefined>(() => undefined);
