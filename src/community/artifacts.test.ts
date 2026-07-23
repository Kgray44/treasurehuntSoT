import { describe, expect, it } from "vitest";
import {
  createArtifactPreviewContract,
  inspectGlb,
  validateArtifact2D,
  validateArtifact3D,
  validateArtifactGraph,
} from "./artifacts";
import { CommunityError } from "./domain";

const license = {
  key: "CC_BY_4_0",
  allowsRemix: true,
  allowsCommercialUse: true,
  requiresAttribution: true,
  requiresShareAlike: false,
} as const;
const artifact2d = {
  id: "map-fragment",
  kind: "ARTIFACT_2D" as const,
  title: "Map fragment",
  description: "A torn map fragment with a lighthouse marker.",
  license,
  image: { path: "artifacts/map.webp", mediaType: "image/webp" as const, dimensions: { width: 1024, height: 768 } },
  accessibility: { description: "A torn map with a lighthouse marker." },
};
const artifact3d = {
  id: "compass",
  kind: "ARTIFACT_3D" as const,
  title: "Brass compass",
  description: "A weathered brass compass.",
  license,
  model: { path: "artifacts/compass.glb", mediaType: "model/gltf-binary" as const },
  poster: {
    path: "artifacts/compass.webp",
    mediaType: "image/webp" as const,
    dimensions: { width: 1024, height: 1024 },
  },
  accessibility: { description: "A weathered brass compass with a north-pointing needle." },
  bounds: { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } },
};

function glb(root: object, bin = new Uint8Array(36)) {
  const raw = new TextEncoder().encode(JSON.stringify(root));
  const padded = new Uint8Array(Math.ceil(raw.length / 4) * 4);
  padded.set(raw);
  padded.fill(0x20, raw.length);
  const result = new Uint8Array(12 + 8 + padded.length + 8 + bin.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, result.byteLength, true);
  view.setUint32(12, padded.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  result.set(padded, 20);
  const binOffset = 20 + padded.length;
  view.setUint32(binOffset, bin.length, true);
  view.setUint32(binOffset + 4, 0x004e4942, true);
  result.set(bin, binOffset + 8);
  return result;
}
function validRoot(count = 3) {
  return {
    asset: { version: "2.0" },
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, count, type: "VEC3" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  };
}
const validGlb = () => glb({ ...validRoot(), images: [{ bufferView: 0 }], textures: [{}] });

describe("Community artifact metadata", () => {
  it("validates typed 2D metadata and requires usable dimensions and descriptions", () => {
    expect(validateArtifact2D(artifact2d).image.dimensions.width).toBe(1024);
    expect(() => validateArtifact2D({ ...artifact2d, accessibility: { description: "" } })).toThrow();
    expect(() =>
      validateArtifact2D({ ...artifact2d, image: { ...artifact2d.image, dimensions: { width: 32, height: 32 } } }),
    ).toThrow();
  });

  it("validates 3D metadata plus a structurally safe GLB", () => {
    expect(validateArtifact3D(artifact3d, validGlb())).toMatchObject({ kind: "ARTIFACT_3D", id: "compass" });
    expect(inspectGlb(validGlb())).toMatchObject({ meshCount: 1, triangleCount: 1, textureCount: 1 });
  });

  it("rejects malformed GLBs, external URIs, and resource-budget excesses", () => {
    expect(() => inspectGlb(new Uint8Array([1, 2, 3]))).toThrow(CommunityError);
    expect(() =>
      inspectGlb(glb({ ...validRoot(), buffers: [{ uri: "https://unsafe.example/model.bin", byteLength: 36 }] })),
    ).toThrow("external buffers");
    expect(() => inspectGlb(glb(validRoot(30)), { maxTriangles: 2 })).toThrow("triangle budget");
    expect(() => inspectGlb(glb({ ...validRoot(), images: [{ uri: "data:image/png;base64,unsafe" }] }))).toThrow(
      "images must be embedded",
    );
  });
});

describe("Artifact collections, assemblies, and previews", () => {
  const transform = {
    position: [0, 0, 0] as [number, number, number],
    rotationDegrees: [0, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
  };
  it("accepts typed collections and assemblies with compatible licences", () => {
    const collection = {
      id: "kit",
      kind: "ARTIFACT_COLLECTION" as const,
      title: "Kit",
      description: "A small kit.",
      license,
      itemIds: [artifact2d.id],
    };
    const assembly = {
      id: "display",
      kind: "ARTIFACT_ASSEMBLY" as const,
      title: "Display",
      description: "A display stand.",
      license,
      components: [{ artifactId: "kit", transform }],
    };
    expect(validateArtifactGraph([artifact2d, artifact3d, collection, assembly])).toHaveLength(4);
  });

  it("rejects recursive, missing, duplicate, and licence-incompatible components", () => {
    const recursive = {
      id: "loop",
      kind: "ARTIFACT_COLLECTION" as const,
      title: "Loop",
      description: "Loop.",
      license,
      itemIds: ["loop"],
    };
    expect(() => validateArtifactGraph([recursive])).toThrow("recursive");
    const missing = { ...recursive, id: "missing", itemIds: ["not-present"] };
    expect(() => validateArtifactGraph([missing])).toThrow("missing");
    const duplicate = { ...recursive, id: "duplicate", itemIds: [artifact2d.id, artifact2d.id] };
    expect(() => validateArtifactGraph([artifact2d, duplicate])).toThrow("repeat");
    const restricted = { ...artifact2d, id: "restricted", license: { ...license, allowsCommercialUse: false } };
    const commercial = { ...recursive, id: "commercial", itemIds: [restricted.id] };
    expect(() => validateArtifactGraph([restricted, commercial])).toThrow("commercial");
  });

  it("produces keyboard and reduced-motion-safe preview contracts", () => {
    expect(createArtifactPreviewContract(artifact2d)).toMatchObject({
      kind: "ARTIFACT_2D",
      reducedMotion: "STATIC_IMAGE",
    });
    expect(createArtifactPreviewContract(artifact3d, true)).toMatchObject({
      kind: "ARTIFACT_3D",
      keyboard: { reset: "Home", pauseAutoRotate: "Space" },
      reducedMotion: "STATIC_POSTER",
      autoRotate: false,
    });
  });
});
