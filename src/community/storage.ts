import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { CommunityError } from "./domain";

export type CommunityStorageNamespace = "staging" | "releases" | "quarantine";
export interface CommunityAssetStorageProvider {
  putStagedObject(ownerId: string, name: string, bytes: Uint8Array): Promise<{ key: string; checksum: string }>;
  copyToImmutableRelease(stagedKey: string, releaseId: string): Promise<{ key: string; checksum: string }>;
  moveToQuarantine(key: string): Promise<{ key: string }>;
  readObject(key: string): Promise<Buffer>;
}
export class LocalCommunityAssetStorage implements CommunityAssetStorageProvider {
  constructor(private readonly root: string) {}
  private safeKey(namespace: CommunityStorageNamespace, ...parts: string[]) {
    const clean = parts.map((part) => {
      if (!/^[a-zA-Z0-9._-]+$/.test(part) || part.includes(".."))
        throw new CommunityError("COMMUNITY_INVALID_STORAGE_KEY", "Unsafe storage key.");
      return part;
    });
    return path.posix.join(namespace, ...clean);
  }
  private full(key: string) {
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(path.resolve(this.root) + path.sep))
      throw new CommunityError("COMMUNITY_INVALID_STORAGE_KEY", "Storage path escapes its root.");
    return resolved;
  }
  async putStagedObject(ownerId: string, name: string, bytes: Uint8Array) {
    const key = this.safeKey("staging", ownerId, name);
    const file = this.full(key);
    await mkdir(path.dirname(file), { recursive: true });
    try {
      await stat(file);
      throw new CommunityError("COMMUNITY_STORAGE_EXISTS", "Storage key already exists.");
    } catch (error) {
      if (error instanceof CommunityError) throw error;
    }
    await writeFile(file, bytes, { flag: "wx" });
    return { key, checksum: createHash("sha256").update(bytes).digest("hex") };
  }
  async copyToImmutableRelease(stagedKey: string, releaseId: string) {
    const bytes = await this.readObject(stagedKey);
    const key = this.safeKey("releases", releaseId, path.basename(stagedKey));
    const file = this.full(key);
    await mkdir(path.dirname(file), { recursive: true });
    try {
      await stat(file);
      throw new CommunityError("COMMUNITY_STORAGE_EXISTS", "Immutable release objects cannot be overwritten.");
    } catch (error) {
      if (error instanceof CommunityError) throw error;
    }
    await writeFile(file, bytes, { flag: "wx" });
    return { key, checksum: createHash("sha256").update(bytes).digest("hex") };
  }
  async moveToQuarantine(key: string) {
    const target = this.safeKey("quarantine", path.basename(key));
    await mkdir(path.dirname(this.full(target)), { recursive: true });
    await rename(this.full(key), this.full(target));
    return { key: target };
  }
  readObject(key: string) {
    return readFile(this.full(key));
  }
}
