import { expect, it } from "vitest";
import { syntheticPublishedChronicle, syntheticBinding, guidedContext } from "./fixtures";
import { parsePublishedSnapshot } from "@/chronicle/types";
import { projectPlayerBlock } from "@/chronicle/journal-contract";
import { runDrydockScenario } from "@/drydock/simulation/engine";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";
import { ParallaxLensRuntime } from "./runtime";
import { evaluateSpatialEvidence } from "./evidence";
import type { DrydockScenario } from "@/drydock/simulation/model";
import { parseDrydockBlock } from "@/drydock/contracts/parser";
import { createSpatialDraft } from "./authoring";
import { materializeSpatialVersion } from "./publication";
import { materializeLibraryMoment } from "./library-service";
import type { JsonObject } from "@/chronicle/types";

it("reopens a synthetic immutable publication, invokes its Lens, and leaves completion with One Voyage", async () => {
  const source = parsePublishedSnapshot(JSON.stringify(syntheticPublishedChronicle()));
  const original = JSON.stringify(source);
  const projected = projectPlayerBlock(source.chapters[0].blocks[0]);
  const moment = projected!.presentation.spatialMoment!;
  const runtime = new ParallaxLensRuntime(moment, syntheticBinding, guidedContext());
  await runtime.open();
  expect(runtime.read().state).toBe("GUIDED_FALLBACK");
  const receipt = await runtime.interact("captains-note", "INSPECT", "published-interaction-1");
  expect(evaluateSpatialEvidence(receipt, moment, syntheticBinding, new Date()).progressionChanged).toBe(false);
  const scenario: DrydockScenario = {
    schemaVersion: 1,
    id: "parallax-mainline-gate",
    revision: 1,
    sourceChecksum: drydockSimulationSourceChecksum(source),
    title: "Published Spatial Moment",
    purpose: "Canonical completion remains independent of local Lens observations.",
    seed: "parallax-phase1",
    initialState: { variables: {}, inventory: [], actorMode: "CREATOR" },
    environment: {
      virtualStart: "2026-10-10T00:00:00.000Z",
      locale: "en-US",
      viewport: "NARROW",
      reducedMotion: true,
      soundEnabled: false,
      keyboardOnly: true,
    },
    limits: { maxSteps: 10, maxStates: 10, maxTraceEntries: 20, maxVirtualMilliseconds: 10000 },
    inputs: [{ kind: "CONTINUE" }, { kind: "CONTINUE" }],
    faults: [],
    assertions: [
      { kind: "STATUS", status: "COMPLETED" },
      { kind: "CURRENT_BLOCK", blockId: "voyage-complete" },
    ],
    tags: ["synthetic", "parallax", "mainline-gate"],
  };
  const result = runDrydockScenario(source, scenario);
  expect(result.status).toBe("COMPLETED");
  expect(result.assertions.every((a) => a.passed)).toBe(true);
  expect(JSON.stringify(source)).toBe(original);
  await runtime.close();
});
it("opens the exact object from a Drydock spatial finding without changing the block contract", () => {
  const draft = createSpatialDraft("owned");
  draft.content.entities[0].transform.position.y = 3.2;
  const capsule = materializeLibraryMoment(draft, "creator", 1);
  capsule.attachment.storyMomentId = "block";
  const result = parseDrydockBlock({
    id: "block",
    blockType: "narrative",
    schemaVersion: 1,
    configuration: { heading: "Clue", body: "Inspect the map." },
    presentation: { spatialMoment: capsule as unknown as JsonObject },
    completion: { mode: "playerConfirmation" },
    connections: [],
  });
  const issue = result.issues.find((i) => i.code === "PARALLAX_HEIGHT_REVIEW")!;
  expect(issue.location.blockId).toBe("block");
  expect(issue.metadata?.spatialStudioHref).toContain("definition=owned");
  expect(issue.metadata?.spatialStudioHref).toContain("entity=owned%3Aentity-0");
});
it("retains object navigation when a checksum-valid spatial version fails scale validation", () => {
  const draft = createSpatialDraft("owned");
  const capsule = materializeLibraryMoment(draft, "creator", 1);
  draft.content.entities[0].widthMeters = 0.01;
  capsule.version = materializeSpatialVersion({ ...draft.content, id: capsule.version.id });
  capsule.attachment.storyMomentId = "block";
  capsule.attachment.versionChecksum = capsule.version.checksum;
  const result = parseDrydockBlock({
    id: "block",
    blockType: "narrative",
    schemaVersion: 1,
    configuration: { heading: "Clue", body: "Inspect the map." },
    presentation: { spatialMoment: capsule as unknown as JsonObject },
    completion: { mode: "playerConfirmation" },
    connections: [],
  });
  expect(
    result.issues.find((i) => i.code === "DRYDOCK_SPATIAL_ATTACHMENT_INVALID")?.metadata?.spatialStudioHref,
  ).toContain("entity=owned%3Aentity-0");
});
