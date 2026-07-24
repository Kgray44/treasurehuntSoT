import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validatePrivateMediaAsset } from "@/private-content/media-validation";

function asset(representation: "image" | "document" | "model-3d", mediaType: string, bytes: Buffer) {
  return {
    logicalId: "asset",
    relativePath: "assets/asset",
    representation,
    mediaType,
    byteLength: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

describe("bounded private media validation", () => {
  it("accepts a structural PNG and rejects a truncated image", () => {
    const png = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
    png.writeUInt32BE(1, 16);
    png.writeUInt32BE(1, 20);
    Buffer.from("IEND").copy(png, 29);
    expect(() => validatePrivateMediaAsset(asset("image", "image/png", png), png)).not.toThrow();
    expect(() =>
      validatePrivateMediaAsset(asset("image", "image/png", Buffer.from("bad")), Buffer.from("bad")),
    ).toThrow();
  });
  it("rejects PDF active content", () => {
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj << /JavaScript (bad) >>\n%%EOF");
    expect(() => validatePrivateMediaAsset(asset("document", "application/pdf", pdf), pdf)).toThrow();
  });
  it("rejects malformed or externally referenced GLB content", () => {
    const malformed = Buffer.from("glTF");
    expect(() => validatePrivateMediaAsset(asset("model-3d", "model/gltf-binary", malformed), malformed)).toThrow();
    const source = '{"buffers":[{"uri":"https://example.invalid/asset.bin"}]}';
    const json = Buffer.from(source.padEnd(Math.ceil(source.length / 4) * 4, " "));
    const glb = Buffer.alloc(12 + 8 + json.length);
    Buffer.from("glTF").copy(glb);
    glb.writeUInt32LE(2, 4);
    glb.writeUInt32LE(glb.length, 8);
    glb.writeUInt32LE(json.length, 12);
    glb.writeUInt32LE(0x4e4f534a, 16);
    json.copy(glb, 20);
    expect(() => validatePrivateMediaAsset(asset("model-3d", "model/gltf-binary", glb), glb)).toThrow();
  });
});
