import { deflateSync } from "node:zlib";
import { surfacePixels, type SurfaceFamily } from "../../src/parallax/assets/surfaces";

function png(rgba: Uint8Array, size: number) {
  const crc = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const b of bytes) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (name: string, data: Uint8Array) => {
    const type = Buffer.from(name),
      buffer = Buffer.alloc(data.length + 12);
    buffer.writeUInt32BE(data.length);
    type.copy(buffer, 4);
    Buffer.from(data).copy(buffer, 8);
    buffer.writeUInt32BE(crc(Buffer.concat([type, Buffer.from(data)])), data.length + 8);
    return buffer;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const scan = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++)
    Buffer.from(rgba.subarray(y * size * 4, (y + 1) * size * 4)).copy(scan, y * (size * 4 + 1) + 1);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(scan)),
    chunk("IEND", new Uint8Array()),
  ]);
}
type Gltf = {
  buffers: { byteLength: number }[];
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number }[];
  materials: { name?: string; pbrMetallicRoughness?: Record<string, unknown>; normalTexture?: unknown }[];
  images?: unknown[];
  textures?: unknown[];
  samplers?: unknown[];
};
/** Embed source-authored PNG base/normal maps in GLB 2.0 without external URIs or a canvas dependency. */
export function embedOriginalSurfaces(binary: ArrayBuffer) {
  const input = Buffer.from(binary),
    jsonLength = input.readUInt32LE(12),
    json = JSON.parse(input.subarray(20, 20 + jsonLength).toString()) as Gltf;
  const binStart = 20 + jsonLength,
    binLength = input.readUInt32LE(binStart);
  let bin = Buffer.from(input.subarray(binStart + 8, binStart + 8 + binLength));
  json.images = [];
  json.textures = [];
  json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  const textures = new Map<string, number>();
  const add = (family: SurfaceFamily, kind: "color" | "normal") => {
    const key = `${family}:${kind}`;
    if (textures.has(key)) return textures.get(key)!;
    const pixels = surfacePixels(family),
      data = png(pixels[kind], pixels.size),
      offset = bin.length;
    bin = Buffer.concat([bin, data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
    const view = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length });
    const image = json.images!.length;
    json.images!.push({ bufferView: view, mimeType: "image/png", name: `original-${key}` });
    const index = json.textures!.length;
    json.textures!.push({ sampler: 0, source: image });
    textures.set(key, index);
    return index;
  };
  for (const material of json.materials) {
    if (!material.name?.startsWith("sc02-")) continue;
    const family = material.name.slice(5) as SurfaceFamily;
    material.pbrMetallicRoughness = {
      ...material.pbrMetallicRoughness,
      baseColorTexture: { index: add(family, "color") },
    };
    material.normalTexture = { index: add(family, "normal"), scale: family === "wood" ? 0.28 : 0.2 };
  }
  json.buffers[0].byteLength = bin.length;
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 32)]);
  const result = Buffer.alloc(12 + 8 + text.length + 8 + bin.length);
  result.writeUInt32LE(0x46546c67, 0);
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(text.length, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  text.copy(result, 20);
  result.writeUInt32LE(bin.length, 20 + text.length);
  result.writeUInt32LE(0x004e4942, 24 + text.length);
  bin.copy(result, 28 + text.length);
  return result;
}
