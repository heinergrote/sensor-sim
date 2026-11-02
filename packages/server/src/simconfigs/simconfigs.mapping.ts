import {NewSimConfigRow, SimConfigRow} from "../db/schema";
import {PatchSimConfig} from "./simconfigs.repository";
import {CreateSimConfig, SimConfig, UpdateSimConfig} from "@sensor-sim/shared";
import {simulationDefinitions} from "../simulation/simulationDefinitions";

// --- helpers ---

type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

/** Drops `undefined` keys but keeps `null` — for use in PATCH updates. */
function stripUndefined<T extends object>(obj: T): Defined<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Defined<T>;
}

/** Compile error if A has keys that B doesn't (spreads skip excess-property checks). */
type NoExtraKeys<A, B> = [Exclude<keyof A, keyof B>] extends [never] ? true : never;

true satisfies NoExtraKeys<UpdateSimConfig, PatchSimConfig>;


// --- DTO -> row ---

export function toCreate(dto: CreateSimConfig, ownerId: number) {

  if (!dto.label) {
    dto.label = undefined;
  }

  return {
    spec: simulationDefinitions.getDefaultSpec("fixed"),
    playing: true,
    ...dto,
    ownerId,
    shareToken: ""
  } satisfies NewSimConfigRow;
}

// example, add timestamps
//function toInsert(dto: CreateSimConfigBody, now: Date) {
//  return { ...dto, createdAt: now, updatedAt: now } satisfies NewUser;
//}

export function toUpdate(dto: UpdateSimConfig) {
  return {
    ...stripUndefined(dto),
  } satisfies PatchSimConfig;
}

export function toDto(row: SimConfigRow): SimConfig {
  return {
    id: row.id,
    label: row.label,
    ownerId: row.ownerId,
    shareToken: row.shareToken,
    spec: row.spec,
    playing: row.playing,
  };
}
