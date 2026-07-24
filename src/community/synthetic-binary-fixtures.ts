import { createHash } from "node:crypto";

type SyntheticBinaryFixture = {
  id: "harborlight-2d-png-v1" | "harborlight-3d-glb-v1";
  base64: string;
  sha256: string;
  byteLength: number;
  detectedMediaType: "image/png" | "model/gltf-binary";
  representationType: "ARTIFACT_2D" | "ARTIFACT_3D";
  expectedValidator: "png-signature-and-bounds" | "glb-embedded-mesh-v1";
};

// These are deliberately tiny, repository-owned validation inputs. They are
// not product assets and are loaded only by the synthetic test scanner.
export const syntheticBinaryFixtures = [
  {
    id: "harborlight-2d-png-v1",
    base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL4VwAAAABJRU5ErkJggg==",
    sha256: "b8de78b17ff409e71de4341bad6876aeebc229e7f81ce594a6d6c5babf62b405",
    byteLength: 70,
    detectedMediaType: "image/png",
    representationType: "ARTIFACT_2D",
    expectedValidator: "png-signature-and-bounds",
  },
  {
    id: "harborlight-3d-glb-v1",
    base64:
      "Z2xURgIAAABcAAAASAAAAEpTT057ICJhc3NldCI6IHsgInZlcnNpb24iOiAiMi4wIiB9LCAibWVzaGVzIjogW3sgInByaW1pdGl2ZXMiOiBbe31dIH1dIH0gICA=",
    sha256: "d620e8e3bc4a8ad3fa355f26ff987618e057f4f34d00bc50d544b4511f6d13d7",
    byteLength: 92,
    detectedMediaType: "model/gltf-binary",
    representationType: "ARTIFACT_3D",
    expectedValidator: "glb-embedded-mesh-v1",
  },
] as const satisfies readonly SyntheticBinaryFixture[];

export function syntheticFixtureBytes(fixture: SyntheticBinaryFixture) {
  return new Uint8Array(Buffer.from(fixture.base64, "base64"));
}

export function assertSyntheticFixtureRegistry() {
  for (const fixture of syntheticBinaryFixtures) {
    const bytes = syntheticFixtureBytes(fixture);
    if (bytes.byteLength !== fixture.byteLength || createHash("sha256").update(bytes).digest("hex") !== fixture.sha256)
      throw new Error(`Synthetic fixture registry is corrupt: ${fixture.id}`);
  }
}
