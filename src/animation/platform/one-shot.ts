export type OneShotStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function platformOneShotKey(namespace: string, identity: string, version: string | number) {
  return `lanternwake:phase4:${namespace}:${identity}:${version}`;
}

export function consumeOneShot(key: string, storage: OneShotStorage = sessionStorage) {
  if (storage.getItem(key) === "complete") return false;
  storage.setItem(key, "complete");
  return true;
}

export function hasConsumedOneShot(key: string, storage: OneShotStorage = sessionStorage) {
  return storage.getItem(key) === "complete";
}

export function resetOneShot(key: string, storage: OneShotStorage = sessionStorage) {
  storage.removeItem(key);
}

