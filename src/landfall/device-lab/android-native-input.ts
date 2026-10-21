import { z } from "zod";

const assetId = z.enum(["brass-compass", "treasure-chest"]);
const entityId = z.enum(["fixture-model-brass-compass", "fixture-model-treasure-chest"]);
const intent = z.strictObject({
  type: z.literal("parallax-interaction"),
  sessionId: z.string().min(1).max(128),
  epoch: z.number().int().positive(),
  entityId,
  interactionType: z.enum(["PICK", "INSPECT"]),
});
const proof = z.strictObject({
  schemaVersion: z.literal(1),
  evidenceClass: z.literal("INSTRUMENTED_NATIVE_INPUT_ONLY"),
  fixtureUsesCamera: z.literal(false),
  fixtureCreatesARCoreSession: z.literal(false),
  physicalTrackingProven: z.literal(false),
  canonicalOutcomeProven: z.literal(false),
  inputMethod: z.literal("INSTRUMENTATION_SEND_POINTER_SYNC"),
  intentBinding: z.literal("SYNTHETIC_SESSION_PRODUCTION_EVENT_FACTORY"),
  largeTextEscapeLayoutVerified: z.literal(true),
  assets: z
    .array(
      z.strictObject({
        assetId,
        entityId,
        meshTapObserved: z.literal(true),
        pickIntentCount: z.literal(1),
        inspectIntentCount: z.literal(1),
        inspectLocalSuccessShown: z.literal(false),
        inspectPendingGuidanceShown: z.literal(true),
        manualReturnVerified: z.literal(true),
        loadingAndTrackingGatesVerified: z.literal(true),
        latePickAfterCloseRejected: z.literal(true),
        intents: z.array(intent).length(2),
      }),
    )
    .length(2),
});

/** A native touch/control receipt never certifies the HTTP outcome or AR tracking. */
export function parseAndroidNativeInputProof(raw: string) {
  if (Buffer.byteLength(raw) > 8192) throw new Error("NATIVE_INPUT_RECORD_TOO_LARGE");
  const value = proof.parse(JSON.parse(raw));
  if (new Set(value.assets.map((asset) => asset.assetId)).size !== 2) throw new Error("NATIVE_INPUT_IDENTITY_MISMATCH");
  for (const asset of value.assets) {
    if (
      asset.entityId !== `fixture-model-${asset.assetId}` ||
      asset.intents[0].interactionType !== "PICK" ||
      asset.intents[1].interactionType !== "INSPECT" ||
      asset.intents.some((event) => event.entityId !== asset.entityId) ||
      asset.intents[0].sessionId !== asset.intents[1].sessionId ||
      asset.intents.some((event) => event.sessionId !== `native-input-${asset.assetId}` || event.epoch !== 1)
    )
      throw new Error("NATIVE_INPUT_IDENTITY_MISMATCH");
  }
  return value;
}
