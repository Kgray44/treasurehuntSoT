import { mkdir, writeFile } from "node:fs/promises";
import { syntheticSpatialMoment } from "../../src/parallax/fixtures";
import { identityTransform } from "../../src/parallax/contracts";
import { materializeSpatialVersion } from "../../src/parallax/publication";
import { createSceneDelivery } from "../../src/parallax/scene-delivery";

// Synthetic portable contract fixture. Never captures an account, device, or room.
async function main() {
  const moment = syntheticSpatialMoment();
  const { checksum: _checksum, ...content } = moment.version;
  void _checksum;
  content.entities[0].widthMeters = 0.16;
  content.entities[0].element = {
    enabled: true,
    kind: "PHYSICAL_ASSET",
    modelId: "brass-compass",
    packageVersion: "1.0.0",
    articulation: 0,
  };
  const version = materializeSpatialVersion(content);
  const scene = createSceneDelivery({
    version,
    instanceId: "instance:ncl01-fixture:run",
    playthroughId: "ncl01-synthetic-voyage",
    blockId: "ncl01-block",
    transforms: new Map(version.entities.map((e) => [e.id, identityTransform()])),
    visibleEntityIds: version.entities.map((e) => e.id),
    elapsedMs: 0,
  });
  const sceneCases = [{ name: "original compass", accepted: true, scene }];
  for (const [name, mutate] of [
    [
      "missing parent",
      (s: typeof scene) => {
        s.entities[0].parentEntityId = "missing";
      },
    ],
    [
      "corrupt model identity",
      (s: typeof scene) => {
        s.entities[0].model!.sha256 = "0".repeat(64);
      },
    ],
    [
      "external asset",
      (s: typeof scene) => {
        s.entities[0].model!.url = "https://invalid.example/compass.glb";
      },
    ],
    [
      "stale revision",
      (s: typeof scene) => {
        s.identity.versionChecksum = "b".repeat(64);
      },
    ],
    [
      "undeclared model",
      (s: typeof scene) => {
        s.requirements = [];
      },
    ],
    [
      "duplicate entity",
      (s: typeof scene) => {
        s.entities.push(structuredClone(s.entities[0]));
      },
    ],
  ] as const) {
    const invalid = structuredClone(scene);
    mutate(invalid);
    sceneCases.push({ name, accepted: false, scene: invalid });
  }
  const output = "tests/fixtures/parallax/native-delivery-v2.json";
  await mkdir("tests/fixtures/parallax", { recursive: true });
  await writeFile(
    output,
    `${JSON.stringify({ schemaVersion: 1, evidenceClass: "D0_SYNTHETIC_CONTRACT_ONLY", sceneCases }, null, 2)}\n`,
  );
  console.log(output);
}
void main();
