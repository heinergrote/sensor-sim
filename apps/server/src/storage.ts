import {createStorage, Storage} from "unstorage";
import fsDriver from "unstorage/drivers/fs";
import * as fs from "node:fs";
import * as path from "node:path";

const storageDir = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./data/storage");

let storage: Storage | null = null

export function getStorage() {
  if (!storage) {
    fs.mkdirSync(storageDir, {recursive: true});
    fs.accessSync(storageDir, fs.constants.W_OK);
    storage = createStorage({
      driver: fsDriver({base: storageDir}),
    });
  }
  return storage;
}