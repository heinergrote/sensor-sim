// --- DTO -> row ---

import {NewUserRow, UpdateUserRow, UserRow} from "../db/schema";
import {CreateUser, UpdateUser, User} from "@sensor-sim/shared";

export function toCreate(dto: CreateUser) {
  return {
    ...dto,
  } satisfies NewUserRow;
}

// example, add timestamps
//function toInsert(dto: SomeDto, now: Date) {
//  return { ...dto, createdAt: now, updatedAt: now } satisfies NewSomeRow;
//}

export function toUpdate(dto: UpdateUser) {
  return {
    ...dto,
  } satisfies UpdateUserRow;
}

export function toDto(row: UserRow): User {
  // password gets stripped
  return {
    id: row.id,
    username: row.username,
    admin: row.admin,
  };
}
