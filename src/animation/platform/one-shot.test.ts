import { describe, expect, it } from "vitest";
import { consumeOneShot, hasConsumedOneShot, platformOneShotKey, resetOneShot } from "./one-shot";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

describe("Phase 4 one-shot keys", () => {
  it.each([
    ["landing-arrival", "tab", 1],
    ["remembered-session", "player", 3],
    ["invitation-reveal", "invite-1", 2],
    ["invitation-acceptance", "invite-1", 2],
    ["waiting-room-launch", "voyage-1", 9],
    ["publish-success", "tale-1", 4],
    ["version-created", "tale-1", 5],
    ["badge-entrance", "section-1", 7],
  ])("consumes %s exactly once per identity/version", (namespace, identity, version) => {
    const storage = memoryStorage();
    const key = platformOneShotKey(namespace, identity, version);
    expect(consumeOneShot(key, storage)).toBe(true);
    expect(consumeOneShot(key, storage)).toBe(false);
    expect(hasConsumedOneShot(key, storage)).toBe(true);
    resetOneShot(key, storage);
    expect(consumeOneShot(key, storage)).toBe(true);
  });
});

