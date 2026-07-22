import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canTransitionPrivateOperation } from "@/private-content/contracts";
import { LocalPrivateKeyProvider, UnconfiguredProductionKeyProvider } from "@/private-content/key-provider";
import { decryptNormalizedPayload, encryptNormalizedPayload } from "@/private-content/payloads";
import { SyntheticPrivateScanner, UnconfiguredPrivateScanner } from "@/private-content/scanner";
import {
  decryptPrivateFrames,
  decryptPrivateFrameStream,
  encryptPrivateFrames,
  encryptPrivateFrameStream,
} from "@/private-content/streaming";

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
});
