import { createReadStream } from "node:fs";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isWithin, privateFailure, sha256 } from "./core";

export type StagedPrivateObject = { stagingId: string; sha256: string; byteLength: number };
export type StoredPrivateObject = { sha256: string; storageKey: string; byteLength: number };

function safeConfiguredRoot(value: string | undefined, label: string) {
  if (!value || !path.isAbsolute(value)) throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", `${label} is not configured securely.`);
  const resolved = path.resolve(value); const repository = path.resolve(process.cwd());
  const forbidden = [repository, path.join(repository, "public"), path.join(repository, ".next"), path.join(repository, "src")];
  if (forbidden.some((candidate) => isWithin(candidate, resolved) || isWithin(resolved, candidate))) throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", `${label} is not configured securely.`);
  return resolved;
}

export class LocalPrivateAssetStore {
  readonly root: string; readonly stagingRoot: string;
  constructor(input: { root?: string; stagingRoot?: string } = {}) {
    this.root = safeConfiguredRoot(input.root ?? process.env.PRIVATE_CONTENT_ROOT, "Private content storage");
    this.stagingRoot = safeConfiguredRoot(input.stagingRoot ?? process.env.PRIVATE_CONTENT_STAGING_ROOT, "Private content staging");
    if (this.root === this.stagingRoot) throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private storage roots must be distinct.");
  }
  private objectPath(hash: string) {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw privateFailure("PRIVATE_PACKAGE_INVALID");
    return path.join(this.root, "objects", hash.slice(0, 2), hash.slice(2, 4), hash);
  }
  async stageObject(buffer: Buffer, expectedSha256 = sha256(buffer)): Promise<StagedPrivateObject> {
    if (sha256(buffer) !== expectedSha256) throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
    const stagingId = randomUUID(); const directory = path.join(this.stagingRoot, stagingId); const target = path.join(directory, expectedSha256);
    await mkdir(directory, { recursive: true, mode: 0o700 }); await writeFile(target, buffer, { flag: "wx", mode: 0o600 });
    return { stagingId, sha256: expectedSha256, byteLength: buffer.length };
  }
  async finalizeObject(staged: StagedPrivateObject): Promise<StoredPrivateObject> {
    const source = path.join(this.stagingRoot, staged.stagingId, staged.sha256); const destination = this.objectPath(staged.sha256);
    const bytes = await readFile(source); if (bytes.length !== staged.byteLength || sha256(bytes) !== staged.sha256) throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    try { await rename(source, destination); } catch (error: unknown) {
      if (!(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "EEXIST")) throw error;
      const existing = await readFile(destination); if (existing.length !== staged.byteLength || sha256(existing) !== staged.sha256) throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
    }
    await this.deleteStagedObject(staged.stagingId);
    return { sha256: staged.sha256, storageKey: `objects/${staged.sha256.slice(0, 2)}/${staged.sha256.slice(2, 4)}/${staged.sha256}`, byteLength: staged.byteLength };
  }
  async objectExists(hash: string) { try { await access(this.objectPath(hash)); return true; } catch { return false; } }
  async verifyObject(hash: string) { try { const bytes = await readFile(this.objectPath(hash)); return { exists: true, valid: sha256(bytes) === hash, byteLength: bytes.length }; } catch { return { exists: false, valid: false, byteLength: 0 }; } }
  async readObject(hash: string) { return readFile(this.objectPath(hash)); }
  readObjectStream(hash: string) { return createReadStream(this.objectPath(hash)); }
  async deleteStagedObject(stagingId: string) { if (!/^[a-f0-9-]{36}$/i.test(stagingId)) return; await rm(path.join(this.stagingRoot, stagingId), { recursive: true, force: true }); }
  async deleteUnreferencedObject(hash: string) { await rm(this.objectPath(hash), { force: true }); }
  async storageUsage() { try { return (await stat(this.root)).isDirectory(); } catch { return false; } }
}
