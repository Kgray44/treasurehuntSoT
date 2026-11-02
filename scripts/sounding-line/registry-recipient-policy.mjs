// Installed public pins only. Selection never grants custody or evidence credit.
import { createHash, createPublicKey } from "node:crypto";
import { BROWSER_FAILURE_ENCRYPTION_KEY } from "./private-browser-failure.mjs";

// A future source change requires reviewed owner recovery evidence. No runtime
// argument, environment variable, callback or filesystem discovery can set it.
const RECOVERED_INTERNAL_REGISTRY_RECIPIENT = null;
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_REGISTRY_RECIPIENT_${code}`);
};
function pin(value, minimumBits) {
  need(value && Object.keys(value).sort().join(",") === "keyId,publicKey", "PIN");
  need(typeof value.publicKey === "string" && value.publicKey.length <= 8192, "PIN");
  need(createHash("sha256").update(value.publicKey).digest("hex") === value.keyId, "PIN");
  const key = createPublicKey(value.publicKey);
  need(key.asymmetricKeyType === "rsa" && key.asymmetricKeyDetails.modulusLength >= minimumBits, "PIN");
  return Object.freeze({ publicKey: value.publicKey, keyId: value.keyId });
}
const legacy = pin(BROWSER_FAILURE_ENCRYPTION_KEY, 2048);
const recovered =
  RECOVERED_INTERNAL_REGISTRY_RECIPIENT === null ? null : pin(RECOVERED_INTERNAL_REGISTRY_RECIPIENT, 3072);
need(!recovered || recovered.keyId !== legacy.keyId, "GENERATION_COLLISION");

export function installedRegistryWriteRecipient() {
  return recovered ?? legacy;
}
export function installedRegistryReadRecipient(keyId) {
  need(typeof keyId === "string" && /^[a-f0-9]{64}$/u.test(keyId), "KEY_ID");
  const selected = [recovered, legacy].find((entry) => entry && entry.keyId === keyId);
  need(selected, "UNKNOWN_KEY_ID");
  return selected;
}
export function registryRecipientPolicyObservation() {
  return Object.freeze({
    generation: recovered ? "SOURCE_PINNED_INTERNAL_SHADOW" : "LEGACY_ONLY_UNRECOVERED_SHADOW",
    writerKeyId: installedRegistryWriteRecipient().keyId,
    readerKeyIds: Object.freeze([recovered, legacy].filter(Boolean).map((entry) => entry.keyId)),
    qualification: false,
    reuseAuthorized: false,
    custodyEstablished: false,
  });
}
