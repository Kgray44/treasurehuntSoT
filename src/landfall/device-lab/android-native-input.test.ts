// @vitest-environment node
import { expect, it } from "vitest";
import { parseAndroidNativeInputProof } from "./android-native-input";

function fixture() {
  return {
    schemaVersion: 1,
    evidenceClass: "INSTRUMENTED_NATIVE_INPUT_ONLY",
    fixtureUsesCamera: false,
    fixtureCreatesARCoreSession: false,
    physicalTrackingProven: false,
    canonicalOutcomeProven: false,
    inputMethod: "INSTRUMENTATION_SEND_POINTER_SYNC",
    intentBinding: "SYNTHETIC_SESSION_PRODUCTION_EVENT_FACTORY",
    largeTextEscapeLayoutVerified: true,
    assets: ["brass-compass", "treasure-chest"].map((assetId) => ({
      assetId,
      entityId: `fixture-model-${assetId}`,
      meshTapObserved: true,
      pickIntentCount: 1,
      inspectIntentCount: 1,
      inspectLocalSuccessShown: false,
      inspectPendingGuidanceShown: true,
      manualReturnVerified: true,
      loadingAndTrackingGatesVerified: true,
      latePickAfterCloseRejected: true,
      accessibilityCenter: {
        inputMethod: "ACCESSIBILITY_ACTION_CLICK",
        meshSelected: true,
        hiddenBackgroundMissVerified: true,
        loadingAndTrackingGatesVerified: true,
        manualReturnVerified: true,
        closedGuardVerified: true,
        pickIntentCount: 1,
        inspectIntentCount: 1,
        intents: ["PICK", "INSPECT"].map((interactionType) => ({
          type: "parallax-interaction",
          sessionId: `native-accessible-${assetId}`,
          epoch: 1,
          entityId: `fixture-model-${assetId}`,
          interactionType,
        })),
      },
      intents: ["PICK", "INSPECT"].map((interactionType) => ({
        type: "parallax-interaction",
        sessionId: `native-input-${assetId}`,
        epoch: 1,
        entityId: `fixture-model-${assetId}`,
        interactionType,
      })),
    })),
  };
}
it("retains two distinct original-model native inputs with narrow evidence fidelity", () => {
  expect(parseAndroidNativeInputProof(JSON.stringify(fixture())).assets).toHaveLength(2);
});
it("refuses false hardware or canonical outcome promotion and absent touch/control assertions", () => {
  for (const field of [
    "physicalTrackingProven",
    "canonicalOutcomeProven",
    "fixtureUsesCamera",
    "fixtureCreatesARCoreSession",
  ])
    expect(() => parseAndroidNativeInputProof(JSON.stringify({ ...fixture(), [field]: true }))).toThrow();
  for (const field of [
    "meshTapObserved",
    "manualReturnVerified",
    "loadingAndTrackingGatesVerified",
    "latePickAfterCloseRejected",
  ])
    expect(() => {
      const value = fixture();
      Object.assign(value.assets[0], { [field]: false });
      parseAndroidNativeInputProof(JSON.stringify(value));
    }).toThrow();
});
it("rejects entity substitution, stale binding, duplicate assets and reversed actions", () => {
  for (const mutate of [
    (value: ReturnType<typeof fixture>) => {
      value.assets[0].intents[1].entityId = "fixture-model-treasure-chest";
    },
    (value: ReturnType<typeof fixture>) => {
      value.assets[0].intents[1].epoch++;
    },
    (value: ReturnType<typeof fixture>) => {
      for (const event of value.assets[0].intents) event.epoch++;
    },
    (value: ReturnType<typeof fixture>) => {
      for (const event of value.assets[0].intents) event.sessionId = "foreign-session";
    },
    (value: ReturnType<typeof fixture>) => {
      value.assets[1] = value.assets[0];
    },
    (value: ReturnType<typeof fixture>) => {
      value.assets[0].intents.reverse();
    },
  ]) {
    const value = fixture();
    mutate(value);
    expect(() => parseAndroidNativeInputProof(JSON.stringify(value))).toThrow();
  }
});

it("requires actual accessibility input assertions and a distinct coherent canonical entity binding", () => {
  for (const field of [
    "meshSelected",
    "hiddenBackgroundMissVerified",
    "loadingAndTrackingGatesVerified",
    "manualReturnVerified",
    "closedGuardVerified",
  ]) {
    const value = fixture();
    Object.assign(value.assets[0].accessibilityCenter, { [field]: false });
    expect(() => parseAndroidNativeInputProof(JSON.stringify(value))).toThrow();
  }
  for (const mutate of [
    (value: ReturnType<typeof fixture>) => {
      value.assets[0].accessibilityCenter.inputMethod = "PERFORM_CLICK_MOCK";
    },
    (value: ReturnType<typeof fixture>) => {
      value.assets[0].accessibilityCenter.intents[0].entityId = value.assets[1].entityId;
    },
    (value: ReturnType<typeof fixture>) => {
      value.assets[0].accessibilityCenter.intents[1].epoch++;
    },
    (value: ReturnType<typeof fixture>) => {
      for (const event of value.assets[0].accessibilityCenter.intents) event.sessionId = "native-input-brass-compass";
    },
    (value: ReturnType<typeof fixture>) => {
      value.assets[0].accessibilityCenter.intents.reverse();
    },
  ]) {
    const value = fixture();
    mutate(value);
    expect(() => parseAndroidNativeInputProof(JSON.stringify(value))).toThrow();
  }
});

it("refuses oversized receipts and unknown nested fields", () => {
  expect(() => parseAndroidNativeInputProof(" ".repeat(8193))).toThrow("NATIVE_INPUT_RECORD_TOO_LARGE");
  const value = fixture();
  Object.assign(value.assets[0].intents[0], { privateToken: "should-never-be-exported" });
  expect(() => parseAndroidNativeInputProof(JSON.stringify(value))).toThrow();
});
