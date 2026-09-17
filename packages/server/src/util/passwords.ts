import {randomBytes, scrypt, timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";

const scryptAsync = promisify(scrypt);

const SALT_LEN = 16;
const KEY_LEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN).toString("hex");
  const hash = (await scryptAsync(plain, salt, KEY_LEN)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  // check if stored password is in the correct format
  if (!stored.includes(":")) {
    return false;
  }
  const split = stored.split(":");

  if (split.length !== 2) {
    return false;
  }

  const [salt, storedHash] = split;

  const hash = (await scryptAsync(plain, salt, KEY_LEN)) as Buffer;
  const storedBuf = Buffer.from(storedHash, "hex");
  // timingSafeEqual prevents timing attacks
  return hash.byteLength === storedBuf.byteLength && timingSafeEqual(hash, storedBuf);
}
