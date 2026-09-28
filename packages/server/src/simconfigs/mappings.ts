import {NewSimConfig, SimConfigRow} from "../db/schema";
import {PatchSimConfig} from "./simconfigs.repository";
import {CreateSimConfigDto, SimConfigDto, UpdateSimConfigDto} from "../sharedTypes";
import {randomOffset} from "../util/randomOffset";


const defaultTarget = {latitude: 52.264683, longitude: 10.523783};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/** Defaults for a new config, randomized so new sims don't all start on top of each other. */
function createDefaults() {
  const target = randomOffset(defaultTarget, 0, 500);
  return {
    label: undefined,
    targetLatitude: target.latitude,
    targetLongitude: target.longitude,
    type: "follow",
    initialDistance: randomBetween(50, 200),
    initialAzimuth: randomBetween(0, 360),
    speed: Math.round(randomBetween(5, 20)), // whole m/s, matching the UI's speed slider steps
    playing: true
  } as const;
}


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

true satisfies NoExtraKeys<UpdateSimConfigDto, PatchSimConfig>;


// --- DTO -> row ---

export function toInsert(dto: CreateSimConfigDto, ownerId: number) {

  if (!dto.label) {
    dto.label = undefined;
  }

  return {
    ...createDefaults(),
    ...dto,
    ownerId,
    shareToken: ""
  } satisfies NewSimConfig;
}

// example, add timestamps
//function toInsert(dto: CreateSimConfigBody, now: Date) {
//  return { ...dto, createdAt: now, updatedAt: now } satisfies NewUser;
//}

export function toUpdate(dto: UpdateSimConfigDto) {
  return {
    ...stripUndefined(dto),
  } satisfies PatchSimConfig;
}

export function toDto(row: SimConfigRow): SimConfigDto {
  return {
    id: row.id,
    label: row.label,
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
