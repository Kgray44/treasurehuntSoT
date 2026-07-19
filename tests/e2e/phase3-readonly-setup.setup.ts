import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  expect,
  phase3PreseededManifestPath,
  phase3Test,
  type Phase3CaseFixture,
  type Phase3EventType,
  type Phase3PreseededFixtureManifest,
  type Phase3SanitizedFixtureIdentity,
} from "./fixtures/lanternwake-phase3";

const READ_ONLY_EVENT_TYPES = [
  "CHAPTER_RELEASED",
  "MAP_LOCATION_REVEALED",
  "MAP_ROUTE_REVEALED",
  "ARTIFACT_AWARDED",
  "ARTIFACT_SILHOUETTE_REVEALED",
  "ARTIFACT_CONNECTED",
  "SIDE_QUEST_DISCOVERED",
  "SIDE_QUEST_UPDATED",
  "SIDE_QUEST_COMPLETED",
  "PLAYER_LOG_ENTRY_ADDED",
  "FINALE_TEASED",
  "FINALE_REQUIREMENT_UPDATED",
  "CAMPAIGN_PAUSED",
] as const satisfies readonly Phase3EventType[];

function sanitized(fixture: Phase3CaseFixture): Phase3SanitizedFixtureIdentity {
  const { accessCode: _accessCode, preseeded: _preseeded, ...identity } = fixture;
  void _accessCode;
  void _preseeded;
  const frozen = Object.freeze(identity);
  expect(frozen.eventType).toBe(fixture.eventType);
  expect(frozen).not.toHaveProperty("accessCode");
  expect(frozen).not.toHaveProperty("preseeded");
  return frozen;
}

phase3Test("creates nonce-bound read-only Phase 3 browser fixtures", async ({ phase3 }) => {
  phase3Test.setTimeout(120_000);
  await phase3.proveIsolation();
  const base = await phase3.createCase("P3-READONLY-BASE", "PLAYER_LOG_ENTRY_ADDED");
  phase3.retainForReadOnly(base);

  const fixtures: Phase3PreseededFixtureManifest["fixtures"] = {};
  for (const eventType of READ_ONLY_EVENT_TYPES) {
    const fixture = await phase3.createCase(`P3-READONLY-${eventType}`, eventType);
    const receipt = await phase3.publish(fixture);
    expect(receipt.event.type).toBe(eventType);
    phase3.retainForReadOnly(fixture);
    fixtures[eventType] = Object.freeze({
      fixture: sanitized(fixture),
      eventId: receipt.event.id,
      eventSequence: receipt.event.sequence,
    });
  }

  const validationNonceHash = process.env.FOREVER_VALIDATION_NONCE_HASH;
  expect(validationNonceHash).toMatch(/^[a-f0-9]{64}$/u);
  const manifest: Phase3PreseededFixtureManifest = Object.freeze({
    version: 1,
    validationNonceHash: validationNonceHash!,
    base: sanitized(base),
    fixtures: Object.freeze(fixtures),
  });
  const manifestPath = phase3PreseededManifestPath();
  const artifactsRoot = path.resolve(process.env.VALIDATION_ARTIFACTS ?? path.join("artifacts", "validation"));
  const relative = path.relative(artifactsRoot, manifestPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Phase 3 read-only fixture manifest must stay inside the validation artifact root.");
  }
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8" });
});
