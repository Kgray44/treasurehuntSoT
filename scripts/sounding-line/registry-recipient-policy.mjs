// Installed public pins only. Selection never grants custody or evidence credit.
import { createHash, createPublicKey } from "node:crypto";
import { BROWSER_FAILURE_ENCRYPTION_KEY } from "./private-browser-failure.mjs";

// Two internal-drive recovery canaries, operation 7ce91ab9-9524-4247-b44d-5cefdf56a26f.
// Public owner journal SHA-256: 681af605b4a471f21389a6345454361990f879135f4181d0d304aedcc94c1ef8.
const RECOVERED_INTERNAL_REGISTRY_RECIPIENT = Object.freeze({
  keyId: "80e260dd918cd2abb7f961783f27741d60a82de9357d866684d9f21cda3da258",
  publicKey:
    "-----BEGIN PUBLIC KEY-----\nMIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAvtAG8PaowpatENsUfTvW\nFABh1+PzqO4Y+olONLYNFIt0AspfWdaJQWBLDrL3nMl1ODsg31PqR4cvdU5a9GiW\nYaHVOeb3bXtvm7JWrcAefx8P0EU+rrukShXtn0LtXOXHladQmWq7GhIrlnRG3439\nY1SN1sI06aKODCHQBoE6hsGwEdP30LRAHGQA1enrvql4y8eTU2kTsUXwS1GNJv0B\n7djrg6C1gSedtuX+KedrCneYo2v2l/9Rp74eKWEZjvPtg1kx0e5zpCB3KcNEGPCR\nN6J5ZnxWFXxgW5og5Sl7cYKZX3XsaGk+jOJNkeikjibPC1WElH9cyUxt3k7kve33\nSRqBlTDTwO51CmhmkJD2ZRxEC+z5dCD+bdqXQoOrF+QFHSatI+BEymEsfqGLZknr\n1MKRpDmOl1/ITOgPh4pKX0EOXznOzj7nzbMOU37owpTjQDqTntLwF//sO7vHqEED\nTkhKhFuprWAC2s5yS6TPkXkguFUHut2i6lnay+0nLVgPAgMBAAE=\n-----END PUBLIC KEY-----\n",
});
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
