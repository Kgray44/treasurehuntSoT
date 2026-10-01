import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { landmarkReceiptPayloadSchema, type LandmarkReceiptPayload } from "@/landfall/landmark-contract";
import type { LandfallDefinition } from "@/landfall/schema";

// Process-local, expiring evidence. A restart discards trust and requests re-verification.
// This is deliberately not a durable provider credential or camera store.
const keyHost = globalThis as typeof globalThis & { __landfallLandmarkReceiptKey?: Buffer };
const receiptKey = (keyHost.__landfallLandmarkReceiptKey ??= randomBytes(32));
export const landmarkDefinitionHash = (definition: LandfallDefinition) =>
  createHash("sha256").update(JSON.stringify(definition)).digest("hex");

export function signLandmarkReceipt(input: LandmarkReceiptPayload): string {
  const payload = landmarkReceiptPayloadSchema.parse(input);
  if (payload.expiresAt <= payload.issuedAt || payload.expiresAt - payload.issuedAt > 30_000)
    throw new Error("LANDFALL_LANDMARK_RECEIPT_POLICY");
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", receiptKey).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyLandmarkReceipt(token: string, now: number): LandmarkReceiptPayload {
  if (token.length > 4096) throw new Error("LANDFALL_LANDMARK_RECEIPT_INVALID");
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new Error("LANDFALL_LANDMARK_RECEIPT_INVALID");
  const actual = Buffer.from(signature, "base64url");
  const expected = createHmac("sha256", receiptKey).update(encoded).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("LANDFALL_LANDMARK_RECEIPT_INVALID");
  const payload = landmarkReceiptPayloadSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
  if (payload.issuedAt > now || payload.expiresAt <= now || payload.expiresAt - payload.issuedAt > 30_000)
    throw new Error("LANDFALL_LANDMARK_RECEIPT_EXPIRED");
  return payload;
}
