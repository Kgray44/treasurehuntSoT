import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, rename, rm } from "node:fs/promises";
import path from "node:path";
import { assertSafeArchivePath, privateFailure, sha256, type PrivatePackageManifest } from "./core";
import { readPrivatePackageV2Events } from "./streaming";

export type PrivatePackageFileSource = {
  logicalId: string; relativePath: string; mediaType: string;
  representation: "json" | "image" | "audio" | "video" | "document" | "model-3d" | "binary";
  byteLength: number; sha256: string; openStream(signal?: AbortSignal): AsyncIterable<Uint8Array>;
};
export type PrivatePackageV2Source = { packageId: string; packageRevision: number; manifest: PrivatePackageManifest; files(signal?: AbortSignal): AsyncIterable<PrivatePackageFileSource> };
export type StagedPrivateFile = { logicalId: string; relativePath: string; stagingPath: string; byteLength: number; sha256: string };

/** Filesystem staging sink used by local imports; it holds only one chunk at a time. */
export class LocalPrivatePackageV2Sink {
  private openFile?: { id: string; relativePath: string; expectedBytes: number; expectedSha256: string; bytes: number; index: number; hash: ReturnType<typeof createHash>; file: Awaited<ReturnType<typeof open>>; target: string };
  private manifest?: PrivatePackageManifest;
  private readonly staged: StagedPrivateFile[] = [];
  readonly root: string;
  constructor(root: string) { this.root = path.resolve(root); }
  async beginPackage(manifest: PrivatePackageManifest) { if (this.manifest) throw privateFailure("PRIVATE_PACKAGE_CONFLICT"); this.manifest = manifest; await mkdir(this.root, { recursive: true, mode: 0o700 }); }
  async beginFile(input: Omit<PrivatePackageFileSource, "openStream">) {
    if (!this.manifest || this.openFile || !Number.isSafeInteger(input.byteLength) || input.byteLength < 0) throw privateFailure("PRIVATE_PACKAGE_INVALID");
    const relativePath = assertSafeArchivePath(input.relativePath); if (this.staged.some((file) => file.relativePath.toLocaleLowerCase() === relativePath.toLocaleLowerCase())) throw privateFailure("PRIVATE_PACKAGE_PATH_REJECTED");
    const target = path.join(this.root, `${randomUUID()}.staged`); const file = await open(target, "wx", 0o600);
    this.openFile = { id: input.logicalId, relativePath, expectedBytes: input.byteLength, expectedSha256: input.sha256, bytes: 0, index: 0, hash: createHash("sha256"), file, target };
  }
  async writeFileChunk(input: { logicalId: string; chunkIndex: number; offset: number; bytes: Uint8Array }) {
    const current = this.openFile; if (!current || current.id !== input.logicalId || current.index !== input.chunkIndex || current.bytes !== input.offset || current.bytes + input.bytes.length > current.expectedBytes) throw privateFailure("PRIVATE_PACKAGE_INVALID");
    await current.file.write(input.bytes); current.hash.update(input.bytes); current.bytes += input.bytes.length; current.index++;
  }
  async completeFile(input: { logicalId: string; byteLength: number; sha256: string }) {
    const current = this.openFile; if (!current || current.id !== input.logicalId || current.bytes !== current.expectedBytes || input.byteLength !== current.expectedBytes || input.sha256 !== current.expectedSha256) throw privateFailure("PRIVATE_PACKAGE_INVALID");
    const digest = current.hash.digest("hex"); await current.file.close(); this.openFile = undefined;
    if (digest !== current.expectedSha256) { await rm(current.target, { force: true }); throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH"); }
    const staged: StagedPrivateFile = { logicalId: current.id, relativePath: current.relativePath, stagingPath: current.target, byteLength: current.bytes, sha256: digest }; this.staged.push(staged); return staged;
  }
  async completePackage() { if (!this.manifest || this.openFile) throw privateFailure("PRIVATE_PACKAGE_INVALID"); const expected = [...this.manifest.tales.map((tale) => tale.contentPath), ...this.manifest.assets.map((asset) => asset.relativePath)]; if (expected.length !== this.staged.length || expected.some((path) => !this.staged.find((file) => file.relativePath === path))) throw privateFailure("PRIVATE_PACKAGE_INVALID"); return { manifest: this.manifest, files: [...this.staged] }; }
  async abort() { await this.openFile?.file.close().catch(() => undefined); this.openFile = undefined; await rm(this.root, { recursive: true, force: true }); }
}

export function localFileSource(input: Omit<PrivatePackageFileSource, "openStream"> & { filePath: string }): PrivatePackageFileSource {
  return { ...input, openStream(signal) { const stream = createReadStream(input.filePath); if (signal) signal.addEventListener("abort", () => stream.destroy(privateFailure("PRIVATE_CONTENT_FORBIDDEN")), { once: true }); return stream; } };
}

/** Binds the production event reader to protected staging without base64 conversion. */
export async function stagePrivatePackageV2(input: { source: AsyncIterable<Buffer | Uint8Array>; passphrase: string; stagingRoot: string }) {
  const sink = new LocalPrivatePackageV2Sink(input.stagingRoot);
  try {
    for await (const event of readPrivatePackageV2Events(input.source, input.passphrase)) {
      if (event.kind === "manifest") await sink.beginPackage(event.manifest);
      else if (event.kind === "file-start") await sink.beginFile(event.record as any);
      else if (event.kind === "file-chunk") await sink.writeFileChunk({ ...(event.record as any), bytes: event.bytes });
      else if (event.kind === "file-end") await sink.completeFile(event.record as any);
      else if (event.kind === "terminal") return sink.completePackage();
    }
    throw privateFailure("PRIVATE_PACKAGE_INVALID");
  } catch (error) { await sink.abort(); throw error; }
}
