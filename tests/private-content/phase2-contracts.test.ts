import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canTransitionPrivateOperation } from "@/private-content/contracts";
import {
  LocalPrivateKeyProvider,
  RotatingLocalPrivateKeyProvider,
  UnconfiguredProductionKeyProvider,
} from "@/private-content/key-provider";
import { decryptNormalizedPayload, encryptNormalizedPayload } from "@/private-content/payloads";
import { SyntheticPrivateScanner, UnconfiguredPrivateScanner } from "@/private-content/scanner";
import {
  decryptPrivatePackageV2,
  decryptPrivateFrames,
  decryptPrivateFrameStream,
  encryptPrivatePackageV2,
  encryptPrivateFrames,
  encryptPrivateFrameStream,
} from "@/private-content/streaming";
import { makePayload } from "@/private-content/package";

async function collect(source: AsyncIterable<Buffer>) {
  const output: Buffer[] = [];
  for await (const value of source) output.push(value);
  return Buffer.concat(output);
}

describe("Sealed Hold Phase 2 frozen contracts", () => {
  it("accepts only governed operation transitions", () => {
    expect(canTransitionPrivateOperation("RECEIVING", "UPLOADED")).toBe(true);
    expect(canTransitionPrivateOperation("COMPLETED", "RECEIVING")).toBe(false);
  });
  it("wraps data keys and rejects tampering", async () => {
    const provider = new LocalPrivateKeyProvider(randomBytes(32));
    const wrapped = await provider.wrap(randomBytes(32));
    await expect(provider.unwrap({ ...wrapped, wrappedKey: `x${wrapped.wrappedKey.slice(1)}` })).rejects.toMatchObject({
      code: "PRIVATE_PACKAGE_AUTHENTICATION_FAILED",
    });
  });
  it("rewraps retained envelope keys and prevents premature old-key retirement", async () => {
    const oldKey = randomBytes(32);
    const keyring = new RotatingLocalPrivateKeyProvider({ old: oldKey, current: randomBytes(32) }, "current");
    const oldRing = new RotatingLocalPrivateKeyProvider({ old: oldKey, current: randomBytes(32) }, "old");
    const wrapped = await oldRing.wrap(Buffer.from("01234567890123456789012345678901"));
    const rewrapped = await keyring.rewrap(wrapped);
    expect(rewrapped.keyVersion).toBe("current");
    expect(await keyring.unwrap(rewrapped)).toHaveLength(32);
    expect(keyring.canRetire("old", ["old"])).toBe(false);
    expect(keyring.canRetire("old", [])).toBe(true);
  });
  it("reports scanner configuration truthfully", async () => {
    expect((await new SyntheticPrivateScanner().scan()).state).toBe("CLEAN");
    expect((await new UnconfiguredPrivateScanner().scan()).state).toBe("NOT_CONFIGURED");
  });
  it("uses a wrapped DEK for normalized retry bytes", async () => {
    const provider = new LocalPrivateKeyProvider(randomBytes(32));
    const encrypted = await encryptNormalizedPayload({ manifest: {} as never, entries: {}, checksums: {} }, provider);
    expect(encrypted.bytes.toString("utf8")).not.toContain("manifest");
    await expect(
      decryptNormalizedPayload(
        { ...encrypted, digest: `${encrypted.digest[0] === "0" ? "1" : "0"}${encrypted.digest.slice(1)}` },
        provider,
      ),
    ).rejects.toMatchObject({ code: "PRIVATE_PACKAGE_AUTHENTICATION_FAILED" });
  });
  it("fails closed for a truncated v2 framed stream", () => {
    const key = randomBytes(32);
    const stream = encryptPrivateFrames([Buffer.from("first"), Buffer.from("second")], key);
    expect(Buffer.concat(decryptPrivateFrames(stream, key)).toString()).toBe("firstsecond");
    expect(() => decryptPrivateFrames(stream.subarray(0, -1), key)).toThrow();
  });
  it("streams fragmented v2 frames without whole-package buffering and rejects trailing bytes", async () => {
    const key = randomBytes(32);
    const wire = await collect(
      encryptPrivateFrameStream(
        (async function* () {
          yield Buffer.from("first");
          yield Buffer.alloc(1024 * 1024, 7);
          yield Buffer.from("last");
        })(),
        key,
      ),
    );
    const fragmented = (async function* () {
      for (let offset = 0; offset < wire.length; offset += 37) yield wire.subarray(offset, offset + 37);
    })();
    const plain = await collect(decryptPrivateFrameStream(fragmented, key));
    expect(plain.subarray(0, 5).toString()).toBe("first");
    expect(plain.subarray(-4).toString()).toBe("last");
    await expect(
      collect(
        decryptPrivateFrameStream(
          (async function* () {
            yield wire;
            yield Buffer.from("unexpected");
          })(),
          key,
        ),
      ),
    ).rejects.toMatchObject({ code: "PRIVATE_PACKAGE_AUTHENTICATION_FAILED" });
  });
  it("honors cancellation before accepting the next v2 plaintext frame", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      collect(
        encryptPrivateFrameStream(
          (async function* () {
            yield Buffer.from("never written");
          })(),
          randomBytes(32),
          controller.signal,
        ),
      ),
    ).rejects.toMatchObject({ code: "PRIVATE_CONTENT_FORBIDDEN" });
  });
  it("round-trips an authenticated v2 manifest and ordered file records", async () => {
    const entry = Buffer.from(JSON.stringify({ schemaVersion: 1 })).toString("base64url");
    const payload = makePayload({
      manifest: {
        packageId: "v2-proof-package",
        packageRevision: 1,
        formatVersion: 1,
        createdAt: "2026-07-22T00:00:00.000Z",
        sourceApplicationVersion: "0.2.0",
        minimumApplicationVersion: "0.2.0",
        classification: "private",
        contentType: "tale-draft",
        tales: [{ logicalId: "tale", slug: "v2-proof", title: "V2 proof", contentPath: "tales/proof.json" }],
        assets: [],
        dependencies: [],
        totals: { files: 1, assets: 0, plaintextBytes: Buffer.from(entry, "base64url").length },
      },
      entries: { "tales/proof.json": entry },
    });
    const wire = await collect(encryptPrivatePackageV2(payload, " exact passphrase "));
    const fragmented = (async function* () {
      for (let i = 0; i < wire.length; i += 7) yield wire.subarray(i, i + 7);
    })();
    await expect(decryptPrivatePackageV2(fragmented, " exact passphrase ")).resolves.toEqual(payload);
    await expect(
      decryptPrivatePackageV2(
        (async function* () {
          yield wire;
        })(),
        "exact passphrase",
      ),
    ).rejects.toMatchObject({ code: "PRIVATE_PACKAGE_AUTHENTICATION_FAILED" });
  });
});
