import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  shadowCaptureContextSchedule,
  captureProductExperience,
} from "../../scripts/sounding-line/experience-browser.mjs";
import { validateExperienceEvidence } from "../../scripts/sounding-line/product-experience.mjs";
const plan = () => ({
  applicable: true,
  prNumber: 900,
  contracts: [
    {
      id: "fixture",
      experience: {
        devices: ["DESKTOP", "MOBILE"],
        motion: true,
        journeys: [{ id: "journey", roles: ["ANONYMOUS", "PLAYER"] }],
      },
    },
  ],
});
test("shadow scheduling preserves original nested-loop order and the journal's exact logical identity encoding", () => {
  const result = shadowCaptureContextSchedule(plan());
  assert.equal(result.length, 8);
  assert.deepEqual(
    result.map((value) => [value.ordinal, value.context.device, value.context.role, value.context.motionMode]),
    [
      [1, "DESKTOP", "ANONYMOUS", "NORMAL"],
      [2, "DESKTOP", "ANONYMOUS", "REDUCED"],
      [3, "DESKTOP", "PLAYER", "NORMAL"],
      [4, "DESKTOP", "PLAYER", "REDUCED"],
      [5, "MOBILE", "ANONYMOUS", "NORMAL"],
      [6, "MOBILE", "ANONYMOUS", "REDUCED"],
      [7, "MOBILE", "PLAYER", "NORMAL"],
      [8, "MOBILE", "PLAYER", "REDUCED"],
    ],
  );
  const identity = {
    contractId: "fixture",
    journeyId: "journey",
    device: "MOBILE",
    role: "PLAYER",
    motionMode: "REDUCED",
    viewport: { width: 390, height: 844 },
  };
  const expected = createHash("sha256")
    .update(JSON.stringify(identity, null, 2) + "\n")
    .digest("hex");
  assert.equal(result[7].contextId, expected);
  assert(Object.isFrozen(result));
  assert(Object.isFrozen(result[7].context.viewport));
});
test("held owners, finite/paired scopes, duplicate contexts and oversized schedules cannot enter single-context mode", () => {
  for (const prNumber of [721, 776, 805, undefined])
    assert.throws(() => shadowCaptureContextSchedule({ ...plan(), prNumber }), /SHADOW_CONTEXT_SCOPE_INVALID/u);
  for (const extra of [{ exception: {} }, { pairedOnly: true }, { localProof: "finite" }])
    assert.throws(() => shadowCaptureContextSchedule({ ...plan(), ...extra }), /SHADOW_CONTEXT_SCOPE_INVALID/u);
  const repeated = plan();
  repeated.contracts[0].experience.devices.push("DESKTOP");
  assert.throws(() => shadowCaptureContextSchedule(repeated), /SHADOW_CONTEXT_SCOPE_INVALID/u);
  const large = plan();
  large.contracts[0].experience.journeys = Array.from({ length: 20 }, (_, i) => ({
    id: `journey-${i}`,
    roles: ["ANONYMOUS", "PLAYER"],
  }));
  assert.throws(() => shadowCaptureContextSchedule(large), /SHADOW_CONTEXT_SCOPE_INVALID/u);
});
test("unknown context and malformed private cache are denied before any filesystem or browser work", async () => {
  const current = plan(),
    target = shadowCaptureContextSchedule(current)[0];
  for (const shadowContext of [
    { mode: "SHADOW_SINGLE_CONTEXT", contextId: "f".repeat(64) },
    { mode: "ACTIVE", contextId: target.contextId },
    { mode: "SHADOW_SINGLE_CONTEXT", contextId: target.contextId, qualification: true },
  ])
    await assert.rejects(
      captureProductExperience({ root: "does-not-exist", plan: current, shadowContext, rawOutputDirectory: "raw" }),
      /SHADOW_CONTEXT_SCOPE_INVALID/u,
    );
  for (const shadowAuthenticationCache of [
    Buffer.from("invalid"),
    Buffer.from("[[]]"),
    Buffer.alloc(2 * 1024 * 1024 + 1),
  ])
    await assert.rejects(
      captureProductExperience({
        root: "does-not-exist",
        plan: current,
        shadowContext: { mode: "SHADOW_SINGLE_CONTEXT", contextId: target.contextId },
        rawOutputDirectory: "raw",
        shadowAuthenticationCache,
      }),
      /SHADOW_CONTEXT_STATE_INVALID/u,
    );
});
test("partial shadow observations cannot satisfy either automated or reviewed experience acceptance", () => {
  for (const automatedOnly of [false, true])
    assert.throws(
      () =>
        validateExperienceEvidence({
          plan: { applicable: false },
          evidence: { partialContext: { mode: "SHADOW_SINGLE_CONTEXT" } },
          root: "unused",
          automatedOnly,
        }),
      /SHADOW_CONTEXT_CAPTURE_NOT_QUALIFICATION/u,
    );
});
