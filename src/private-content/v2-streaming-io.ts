import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import { assertSafeArchivePath, privateFailure, type PrivatePackageManifest } from "./core";
import {
  readPrivatePackageV2Events,
  type PrivateFileEndRecord,
  type PrivateFileStartRecord,
  type PrivatePackageFileSource,
  type PrivateStreamHeaderV2,
  type PrivateStreamTerminal,
} from "./streaming";

export type { PrivatePackageFileSource, PrivatePackageV2Source } from "./streaming";
export type StagedPrivateFile = {
  logicalId: string;
  relativePath: string;
  stagingPath: string;
  byteLength: number;
  sha256: string;
};
export type ValidatedStagedPrivatePackage = {
  header: PrivateStreamHeaderV2;
  correlationId: string;
  manifest: PrivatePackageManifest;
  files: StagedPrivateFile[];
  terminal: PrivateStreamTerminal;
};
export interface PrivatePackageV2Sink {
  beginPackage(input: {
    header: PrivateStreamHeaderV2;
    manifest: PrivatePackageManifest;
    correlationId: string;
  }): Promise<void>;
  beginFile(input: PrivateFileStartRecord): Promise<void>;
  writeFileChunk(input: { logicalId: string; chunkIndex: number; offset: number; bytes: Uint8Array }): Promise<void>;
  completeFile(input: PrivateFileEndRecord): Promise<StagedPrivateFile>;
  completePackage(input: PrivateStreamTerminal): Promise<ValidatedStagedPrivatePackage>;
  abort(reason: string): Promise<void>;
}

/** Filesystem staging sink used by local imports; it holds only one chunk at a time. */
export class LocalPrivatePackageV2Sink {
  private openFile?: {
    id: string;
    relativePath: string;
    expectedBytes: number;
    expectedSha256: string;
    bytes: number;
    index: number;
    hash: ReturnType<typeof createHash>;
    file: Awaited<ReturnType<typeof open>>;
    target: string;
  };
  private manifest?: PrivatePackageManifest;
  private header?: PrivateStreamHeaderV2;
  private correlationId?: string;
  private expected: Array<{
    logicalId: string;
    relativePath: string;
    mediaType: string;
    representation: string;
    byteLength?: number;
    sha256?: string;
  }> = [];
  private readonly staged: StagedPrivateFile[] = [];
  readonly root: string;
  constructor(root: string) {
    this.root = path.resolve(root);
  }
  async beginPackage(input: {
    header: PrivateStreamHeaderV2;
    manifest: PrivatePackageManifest;
    correlationId: string;
  }) {
    if (
      this.manifest ||
      input.header.packageId !== input.manifest.packageId ||
      input.header.packageRevision !== input.manifest.packageRevision
    )
      throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
    this.manifest = input.manifest;
    this.header = input.header;
    this.correlationId = input.correlationId;
    this.expected = [
      ...input.manifest.tales.map((tale) => ({
        logicalId: tale.logicalId,
        relativePath: tale.contentPath,
        mediaType: "application/json",
        representation: "json",
      })),
      ...input.manifest.assets,
    ];
    if (
      this.expected.length !== input.manifest.totals.files ||
      new Set(this.expected.map((file) => file.logicalId)).size !== this.expected.length
    )
      throw privateFailure("PRIVATE_PACKAGE_INVALID");
    await mkdir(this.root, { recursive: true, mode: 0o700 });
  }
  async beginFile(input: PrivateFileStartRecord) {
    if (!this.manifest || this.openFile || !Number.isSafeInteger(input.byteLength) || input.byteLength < 0)
      throw privateFailure("PRIVATE_PACKAGE_INVALID");
    const expected = this.expected[this.staged.length];
    if (
      !expected ||
      input.logicalId !== expected.logicalId ||
      input.relativePath !== expected.relativePath ||
      input.mediaType !== expected.mediaType ||
      input.representation !== expected.representation ||
      (expected.byteLength !== undefined &&
        (input.byteLength !== expected.byteLength || input.sha256 !== expected.sha256))
    )
      throw privateFailure("PRIVATE_PACKAGE_INVALID");
    const relativePath = assertSafeArchivePath(input.relativePath);
    if (this.staged.some((file) => file.relativePath.toLocaleLowerCase() === relativePath.toLocaleLowerCase()))
      throw privateFailure("PRIVATE_PACKAGE_PATH_REJECTED");
    const target = path.join(this.root, `${randomUUID()}.staged`);
    const file = await open(target, "wx", 0o600);
    this.openFile = {
      id: input.logicalId,
      relativePath,
      expectedBytes: input.byteLength,
      expectedSha256: input.sha256,
      bytes: 0,
      index: 0,
      hash: createHash("sha256"),
      file,
      target,
    };
  }
  async writeFileChunk(input: { logicalId: string; chunkIndex: number; offset: number; bytes: Uint8Array }) {
    const current = this.openFile;
    if (
      !current ||
      current.id !== input.logicalId ||
      current.index !== input.chunkIndex ||
      current.bytes !== input.offset ||
      current.bytes + input.bytes.length > current.expectedBytes
    )
      throw privateFailure("PRIVATE_PACKAGE_INVALID");
    await current.file.write(input.bytes);
    current.hash.update(input.bytes);
    current.bytes += input.bytes.length;
    current.index++;
  }
  async completeFile(input: PrivateFileEndRecord) {
    const current = this.openFile;
    if (
      !current ||
      current.id !== input.logicalId ||
      current.bytes !== current.expectedBytes ||
      input.byteLength !== current.expectedBytes ||
      input.sha256 !== current.expectedSha256
    )
      throw privateFailure("PRIVATE_PACKAGE_INVALID");
    const digest = current.hash.digest("hex");
    await current.file.close();
    this.openFile = undefined;
    if (digest !== current.expectedSha256) {
      await rm(current.target, { force: true });
      throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
    }
    const staged: StagedPrivateFile = {
      logicalId: current.id,
      relativePath: current.relativePath,
      stagingPath: current.target,
      byteLength: current.bytes,
      sha256: digest,
    };
    this.staged.push(staged);
    return staged;
  }
  async completePackage(terminal: PrivateStreamTerminal): Promise<ValidatedStagedPrivatePackage> {
    if (
      !this.manifest ||
      !this.header ||
      !this.correlationId ||
      this.openFile ||
      this.expected.length !== this.staged.length ||
      terminal.fileCount !== this.staged.length
    )
      throw privateFailure("PRIVATE_PACKAGE_INVALID");
    return {
      header: this.header,
      correlationId: this.correlationId,
      manifest: this.manifest,
      files: [...this.staged],
      terminal,
    };
  }
  async abort(reason: string) {
    void reason;
    await this.openFile?.file.close().catch(() => undefined);
    this.openFile = undefined;
    await rm(this.root, { recursive: true, force: true });
  }
}

export function localFileSource(
  input: Omit<PrivatePackageFileSource, "openStream"> & { filePath: string },
): PrivatePackageFileSource {
  return {
    ...input,
    openStream(signal) {
      const stream = createReadStream(input.filePath);
      if (signal)
        signal.addEventListener("abort", () => stream.destroy(privateFailure("PRIVATE_CONTENT_FORBIDDEN")), {
          once: true,
        });
      return stream;
    },
  };
}

/** Binds the production event reader to protected staging without base64 conversion. */
export async function stagePrivatePackageV2(input: {
  source: AsyncIterable<Buffer | Uint8Array>;
  passphrase: string;
  stagingRoot: string;
}) {
  const sink = new LocalPrivatePackageV2Sink(input.stagingRoot);
  let header: PrivateStreamHeaderV2 | undefined;
  try {
    for await (const event of readPrivatePackageV2Events(input.source, input.passphrase)) {
      if (event.kind === "header") header = event.header;
      else if (event.kind === "manifest") {
        if (!header) throw privateFailure("PRIVATE_PACKAGE_INVALID");
        await sink.beginPackage({ header, manifest: event.manifest, correlationId: randomUUID() });
      } else if (event.kind === "file-start") await sink.beginFile(event.record as PrivateFileStartRecord);
      else if (event.kind === "file-chunk")
        await sink.writeFileChunk({
          ...(event.record as { logicalId: string; chunkIndex: number; offset: number }),
          bytes: event.bytes,
        });
      else if (event.kind === "file-end") await sink.completeFile(event.record as PrivateFileEndRecord);
      else if (event.kind === "terminal") return sink.completePackage(event.receipt as PrivateStreamTerminal);
    }
    throw privateFailure("PRIVATE_PACKAGE_INVALID");
  } catch (error) {
    await sink.abort("authentication-or-staging-failed");
    throw error;
  }
}
