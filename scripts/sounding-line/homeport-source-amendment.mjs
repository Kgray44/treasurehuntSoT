import { createHash } from "node:crypto";
import { canonicalJson } from "./evidence.mjs";
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const originalDigest = "a816a0a7d804594f5f2d29960be6be3497c73b6edd48317d6552309ec4cbf236";
const amendmentDigest = "ae3b96c65d9d75167b824931131188e3e9b07a109a499fa805ce668efd25662d";
const paths = ["src/components/studio/ChronicleDetails.tsx", "tests/e2e/chronicle-creation.spec.ts"];
const fail = () => {
  throw Error("PRODUCT_EXPERIENCE_HOMEPORT_MIGRATION_SOURCE_AMENDMENT_INVALID");
};

// Protected-base data only. Keep the original record intact; this finite overlay
// replaces two reviewed blobs and the necessary inherited-registration witness.
export function resolveHomeportSourceAmendment(original, amendment) {
  if (amendment === undefined) return original;
  if (
    !original ||
    typeof original !== "object" ||
    Array.isArray(original) ||
    !amendment ||
    typeof amendment !== "object" ||
    Array.isArray(amendment)
  )
    fail();
  if (
    digest(original) !== originalDigest ||
    digest(amendment) !== amendmentDigest ||
    amendment.originalRecordDigest !== originalDigest ||
    amendment.version !== 1 ||
    amendment.repository !== original.repository ||
    amendment.prNumber !== original.prNumber ||
    amendment.expiresAt !== original.expiresAt ||
    !Array.isArray(amendment.replacements) ||
    amendment.replacements.length !== 2 ||
    canonicalJson(amendment.replacements.map((value) => value.path)) !== canonicalJson(paths)
  )
    fail();
  const replacements = new Map(amendment.replacements.map((value) => [value.path, value]));
  for (const replacement of replacements.values()) {
    const previous = original.approvedChanges.find((value) => value.path === replacement.path);
    if (
      !previous ||
      previous.mode !== "100644" ||
      replacement.mode !== previous.mode ||
      replacement.previousBlob !== previous.blob ||
      !/^[a-f0-9]{40}$/u.test(replacement.blob ?? "") ||
      !/^[a-f0-9]{64}$/u.test(replacement.sha256 ?? "") ||
      !original.browserFixtureAndVisualPins.some((value) => value.path === replacement.path)
    )
      fail();
  }
  const proof = amendment.registrationProof;
  if (
    proof.path !==
      "Development_Docs/Engineering/sc00a-homeport-journey-migration-20261031/source-amendment-20261101/reviewed-registration.json" ||
    !Number.isSafeInteger(proof.bytes) ||
    proof.bytes < 1 ||
    proof.bytes > 2 * 1024 * 1024 ||
    !/^[a-f0-9]{40}$/u.test(proof.blob ?? "") ||
    !/^[a-f0-9]{64}$/u.test(proof.sha256 ?? "") ||
    !/^[a-f0-9]{64}$/u.test(amendment.reviewedRegistrationPolicyDigest ?? "")
  )
    fail();
  const record = JSON.parse(JSON.stringify(original));
  record.acceptedSource = amendment.acceptedSource;
  record.reviewedAncestor = amendment.reviewedAncestor;
  record.reviewedTree = amendment.reviewedTree;
  record.approvedChanges = record.approvedChanges.map((entry) =>
    replacements.has(entry.path)
      ? { ...entry, blob: replacements.get(entry.path).blob }
      : entry.path === "testing/contracts.json"
        ? { ...entry, blob: proof.blob }
        : entry,
  );
  record.browserFixtureAndVisualPins = record.browserFixtureAndVisualPins.map((pin) =>
    replacements.has(pin.path) ? { ...pin, sha256: replacements.get(pin.path).sha256 } : pin,
  );
  record.immutableProofs[1] = { path: proof.path, bytes: proof.bytes, sha256: proof.sha256 };
  return record;
}
export function validateHomeportAmendedRegistration(original, approved, amendment) {
  const withoutPolicy = (value) =>
    Object.fromEntries(Object.entries(value).filter(([key]) => key !== "experiencePolicy"));
  if (
    canonicalJson(withoutPolicy(original)) !== canonicalJson(withoutPolicy(approved)) ||
    digest(approved.experiencePolicy) !== amendment.reviewedRegistrationPolicyDigest
  )
    fail();
}
