// Service — maps between them, and `satisfies` catches drift at compile time
import {CreateSimConfigBody, UpdateSimConfigBody} from "./simConfigsZodSchema";
import {NewSimConfig, SimConfigRow} from "../db/schema";
import {PatchSimConfig} from "./simconfigs.repository";


const defaults = {
  targetLatitude: 52.264683,
  targetLongitude: 10.523783,
  type: "follow",
  initialDistance: 0,
  initialAzimuth: 0,
  speed: 10,
  playing: false
} as const;


// --- helpers ---

type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

/** Drops `undefined` keys but keeps `null` — that's the whole PATCH trick. */
function stripUndefined<T extends object>(obj: T): Defined<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Defined<T>;
}

/** Compile error if A has keys that B doesn't (spreads skip excess-property checks). */
type NoExtraKeys<A, B> = [Exclude<keyof A, keyof B>] extends [never] ? true : never;

true satisfies NoExtraKeys<UpdateSimConfigBody, PatchSimConfig>;


// --- DTO -> row ---

export function toInsert(dto: CreateSimConfigBody, ownerId: number) {
  return {
    ...defaults,
    ...dto,
    ownerId,
    shareToken: ""
  } satisfies NewSimConfig;
}

// example, add timestamps
//function toInsert(dto: CreateSimConfigBody, now: Date) {
//  return { ...dto, createdAt: now, updatedAt: now } satisfies NewUser;
//}


export function toUpdate(dto: UpdateSimConfigBody) {
  return {
    ...stripUndefined(dto),
  } satisfies PatchSimConfig;
}


// Response — never return UserRow directly
export function toDto(row: SimConfigRow) {
  return {
    id: row.id,
    ownerId: row.ownerId,
    type: row.type,
    shareToken: row.shareToken,
    targetLatitude: row.targetLatitude,
    targetLongitude: row.targetLongitude,
    initialDistance: row.initialDistance,
    initialAzimuth: row.initialAzimuth,
    speed: row.speed,
    playing: row.playing,
  };
}