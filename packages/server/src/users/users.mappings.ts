// --- DTO -> row ---

import {CreateUserDto, UpdateUserDto, UserDto} from "../types";
import {NewUserRow, UpdateUserRow, UserRow} from "../db/schema";

export function toInsert(dto: CreateUserDto) {
  return {
    ...dto,
  } satisfies NewUserRow;
}

// example, add timestamps
//function toInsert(dto: SomeDto, now: Date) {
//  return { ...dto, createdAt: now, updatedAt: now } satisfies NewSomeRow;
//}

export function toUpdate(dto: UpdateUserDto) {
  return {
    ...dto,
  } satisfies UpdateUserRow;
}

export function toDto(row: UserRow): UserDto {
  // password gets stripped
  return {
    id: row.id,
    username: row.username,
    admin: row.admin,
  };
}
