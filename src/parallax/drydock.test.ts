import { expect, it } from "vitest";
import { syntheticPublishedChronicle, syntheticBinding, guidedContext } from "./fixtures";
import { parsePublishedSnapshot } from "@/chronicle/types";
import { projectPlayerBlock } from "@/chronicle/journal-contract";
import { runDrydockScenario } from "@/drydock/simulation/engine";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";
import { ParallaxLensRuntime } from "./runtime";
import { evaluateSpatialEvidence } from "./evidence";
import type { DrydockScenario } from "@/drydock/simulation/model";

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
