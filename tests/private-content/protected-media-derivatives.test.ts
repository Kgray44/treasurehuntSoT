import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { buildProtectedMediaRasterDerivatives } from "@/private-content/media/derivatives";
import { sha256 } from "@/private-content/core";

describe("protected derivative worker boundary", () => {
  it("scans each exact private output and exposes no source storage identity", async () => {
    const sourceBytes = await sharp({ create: { width: 64, height: 32, channels: 3, background: "#cc7755" } })
      .png()
      .toBuffer();
    const put = vi.fn(async (_namespace: string, key: string, stream: Readable) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks);
      return { key, sha256: sha256(bytes), byteLength: bytes.length, mediaType: "image/webp" };
    });
    const scanner = {
      name: "synthetic",
      health: vi.fn(),
      scan: vi.fn(async (input: { object: { sha256: string } }) => ({
        state: "CLEAN" as const,
        provider: "synthetic",
        safeCode: input.object.sha256.slice(0, 8),
      })),
    };
    const results = await buildProtectedMediaRasterDerivatives({
      source: {
        key: "objects/private-source-key",
        sha256: sha256(sourceBytes),
        byteLength: sourceBytes.length,
        mediaType: "image/png",
      },
      sourceScanState: "CLEAN",
      declaredMediaType: "image/png",
      storage: {
        name: "local",
        supportsMultipart: false,
        supportsSignedRead: false,
        health: vi.fn(),
        read: vi.fn(async () => Readable.from([sourceBytes])),
        put,
        exists: vi.fn(),
        promote: vi.fn(),
        moveToQuarantine: vi.fn(),
        remove: vi.fn(),
        beginMultipart: vi.fn(),
        uploadPart: vi.fn(),
        completeMultipart: vi.fn(),
        abortMultipart: vi.fn(),
      },
      scanner,
    });
    expect(results).toHaveLength(2);
    expect(scanner.scan).toHaveBeenCalledTimes(2);
    expect(results.map((result) => result.object.key)).not.toContain("objects/private-source-key");
    expect(results.every((result) => result.object.key.startsWith("sealed-hold-public-image-v1/"))).toBe(true);
  });
});
