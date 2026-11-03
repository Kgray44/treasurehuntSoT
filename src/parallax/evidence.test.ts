import { expect, it } from "vitest";
import { evaluateSpatialEvidence } from "./evidence";
import { runtimePresentableEntityIds } from "./behavior";
import { syntheticBinding, syntheticSpatialMoment, guidedContext } from "./fixtures";
import { materializeSpatialVersion } from "./publication";
import { emptyStudioContent } from "./studio-contracts";
import { ParallaxLensRuntime } from "./runtime";

function moment() {
  const value = syntheticSpatialMoment();
  value.version.studio = {
    ...emptyStudioContent(),
    layers: [{ entityId: "captains-note", audience: "BOTH", visible: true, selectable: true, locked: false, tags: [] }],
  };
  return value;
}
function seal(value: ReturnType<typeof moment>) {
  const { checksum, ...content } = value.version;
  void checksum;
  value.version = materializeSpatialVersion(content);
  value.attachment.versionChecksum = value.version.checksum;
  return value;
}
async function receipt() {
  const lens = new ParallaxLensRuntime(syntheticSpatialMoment(), syntheticBinding, guidedContext());
  await lens.open();
  const result = await lens.interact("captains-note", "INSPECT", "canonical-eligibility");
  await lens.close();
  return result;
}
it.each(["EDITOR_ONLY", "DISABLED", "NONSELECTABLE", "HIDDEN", "UNREACHABLE_SHOW"] as const)(
  "rejects %s evidence before persistence even with exact published identity",
  async (kind) => {
    const value = moment(),
      layer = value.version.studio!.layers[0];
    if (kind === "EDITOR_ONLY") layer.audience = "EDITOR_ONLY";
    if (kind === "DISABLED")
      value.version.entities[0].element = {
        kind: "PHYSICAL_ASSET",
        enabled: false,
        modelId: "brass-compass",
        packageVersion: "1.0.0",
        articulation: 0,
      };
    if (kind === "NONSELECTABLE") layer.selectable = false;
    if (["HIDDEN", "UNREACHABLE_SHOW"].includes(kind)) layer.visible = false;
    if (kind === "UNREACHABLE_SHOW")
      value.version.studio!.behaviors.push({
        id: "unreachable",
        trigger: "INSPECT",
        sourceEntityId: "captains-note",
        targetEntityId: "captains-note",
        action: "SHOW",
        delayMs: 0,
      });
    seal(value);
    const forged = { ...(await receipt()), versionChecksum: value.version.checksum };
    expect(() => evaluateSpatialEvidence(forged, value, syntheticBinding, new Date())).toThrow(
      "PARALLAX_EVIDENCE_ENTITY_INELIGIBLE",
    );
    const lens = new ParallaxLensRuntime(value, syntheticBinding, guidedContext());
    await lens.open();
    await expect(lens.interact("captains-note", "INSPECT", "forbidden")).rejects.toThrow(
      "PARALLAX_INTERACTION_FORBIDDEN",
    );
    await lens.close();
  },
);
it("retains valid delayed SHOW entities for Guided meaning and canonical observations while preserving simulation rejection", async () => {
  const value = moment();
  value.version.studio!.layers[0].visible = false;
  value.version.studio!.behaviors.push({
    id: "delayed",
    trigger: "TIMER",
    targetEntityId: "captains-note",
    action: "SHOW",
    delayMs: 60000,
  });
  seal(value);
  expect(runtimePresentableEntityIds(value.version).has("captains-note")).toBe(true);
  const lens = new ParallaxLensRuntime(value, syntheticBinding, guidedContext());
  await lens.open();
  const observed = await lens.interact("captains-note", "INSPECT", "show-guided");
  expect(evaluateSpatialEvidence(observed, value, syntheticBinding, new Date())).toMatchObject({
    disposition: "OBSERVED_ONLY",
    progressionChanged: false,
  });
  expect(() =>
    evaluateSpatialEvidence({ ...observed, mode: "SIMULATED", synthetic: true }, value, syntheticBinding, new Date()),
  ).toThrow("PARALLAX_SIMULATION_FORBIDDEN");
  await lens.close();
});
