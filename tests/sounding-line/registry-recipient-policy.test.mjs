// Isolated preparatory source, not installed or protected qualification.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { generateKeyPairSync, createHash } from "node:crypto";
import { artifactRegistryFixture } from "./fixtures/artifact-registry-v2.mjs";
const pair = (bits) => {
  const key = generateKeyPairSync("rsa", { modulusLength: bits });
  const publicKey = key.publicKey.export({ type: "spki", format: "pem" });
  return {
    privateKey: key.privateKey,
    encryption: { publicKey, keyId: createHash("sha256").update(publicKey).digest("hex") },
  };
};
const legacy = pair(3072),
  recovered = pair(3072),
  unknown = pair(2048);
const binding = {
  repository: "Kgray44/treasurehuntSoT",
  prNumber: 900,
  runId: 101,
  attempt: 1,
  baseSha: "a".repeat(40),
  candidateSha: "b".repeat(40),
  jobKey: "experience-preparation",
  sourceBindingsDigest: "c".repeat(64),
};
async function fixture(t, pin = null) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "registry-policy-fixture-"));
  const names = ["private-browser-failure.mjs", "registry-recipient-policy.mjs", "artifact-registry-retention.mjs"];
  t.after(() => {
    for (const name of names) if (fs.existsSync(path.join(directory, name))) fs.unlinkSync(path.join(directory, name));
    fs.rmdirSync(directory);
  });
  fs.writeFileSync(
    path.join(directory, names[0]),
    `export const BROWSER_FAILURE_ENCRYPTION_KEY=Object.freeze(${JSON.stringify(legacy.encryption)});\n`,
    { flag: "wx" },
  );
  let source = fs.readFileSync(
    new URL("../../scripts/sounding-line/registry-recipient-policy.mjs", import.meta.url),
    "utf8",
  );
  const declaration = "const RECOVERED_INTERNAL_REGISTRY_RECIPIENT = null;";
  assert(source.includes(declaration));
  if (pin)
    source = source.replace(
      declaration,
      `const RECOVERED_INTERNAL_REGISTRY_RECIPIENT = Object.freeze(${JSON.stringify(pin)});`,
    );
  fs.writeFileSync(path.join(directory, names[1]), source, { flag: "wx" });
  let retention = fs.readFileSync(
    new URL("../../scripts/sounding-line/artifact-registry-retention.mjs", import.meta.url),
    "utf8",
  );
  for (const name of ["evidence.mjs", "artifact-evidence-registry.mjs", "replay-posttechnical-diagnostic.mjs"])
    retention = retention.replace(
      `from "./${name}"`,
      `from "${new URL(`../../scripts/sounding-line/${name}`, import.meta.url).href}"`,
    );
  fs.writeFileSync(path.join(directory, names[2]), retention, { flag: "wx" });
  return {
    policy: await import(pathToFileURL(path.join(directory, names[1])).href),
    api: await import(pathToFileURL(path.join(directory, names[2])).href),
  };
}
test("installed default remains legacy-only and grants no custody or reuse", async (t) => {
  const { policy } = await fixture(t);
  assert.deepEqual(policy.installedRegistryWriteRecipient(), legacy.encryption);
  const observation = policy.registryRecipientPolicyObservation();
  assert.equal(observation.generation, "LEGACY_ONLY_UNRECOVERED_SHADOW");
  assert.deepEqual(observation.readerKeyIds, [legacy.encryption.keyId]);
  for (const flag of ["qualification", "reuseAuthorized", "custodyEstablished"]) assert.equal(observation[flag], false);
  assert(Object.isFrozen(policy.installedRegistryWriteRecipient()));
  assert(Object.isFrozen(observation.readerKeyIds));
});
test("source-pinned synthetic generation writes new and reads new plus original legacy identity", async (t) => {
  const { policy, api } = await fixture(t, recovered.encryption),
    manifest = artifactRegistryFixture();
  assert.deepEqual(policy.installedRegistryWriteRecipient(), recovered.encryption);
  for (const selected of [legacy, recovered]) {
    const bytes =
      selected === recovered
        ? api.sealArtifactRegistryRetention({ manifest, binding })
        : api.sealArtifactRegistryRetention({ manifest, binding, encryption: legacy.encryption });
    const opened = api.openArtifactRegistryRetention({ bytes, binding, privateKey: selected.privateKey });
    assert.deepEqual(opened.manifest, manifest);
    assert.equal(opened.qualification, false);
  }
});
test("unknown envelope recipients and caller objects cannot extend the installed reader pins", async (t) => {
  const { policy, api } = await fixture(t, recovered.encryption);
  let called = 0;
  assert.throws(
    () =>
      policy.installedRegistryReadRecipient({
        toString() {
          called++;
          return recovered.encryption.keyId;
        },
      }),
    /KEY_ID/u,
  );
  assert.equal(called, 0);
  assert.throws(
    () => policy.installedRegistryReadRecipient(unknown.encryption.keyId, unknown.encryption),
    /UNKNOWN_KEY_ID/u,
  );
  const bytes = api.sealArtifactRegistryRetention({
    manifest: artifactRegistryFixture(),
    binding,
    encryption: unknown.encryption,
  });
  assert.throws(
    () => api.openArtifactRegistryRetention({ bytes, binding, privateKey: unknown.privateKey }),
    /UNKNOWN_KEY_ID/u,
  );
});
test("new encrypted retention still rejects wrong private key, AAD and ciphertext substitutions", async (t) => {
  const { api } = await fixture(t, recovered.encryption),
    original = api.sealArtifactRegistryRetention({ manifest: artifactRegistryFixture(), binding });
  assert.throws(
    () => api.openArtifactRegistryRetention({ bytes: original, binding, privateKey: legacy.privateKey }),
    /DECRYPTION_FAILED/u,
  );
  assert.throws(
    () =>
      api.openArtifactRegistryRetention({
        bytes: original,
        binding: { ...binding, runId: 102 },
        privateKey: recovered.privateKey,
      }),
    /SOURCE_OR_PURPOSE_MISMATCH/u,
  );
  const changed = JSON.parse(original);
  const cipher = Buffer.from(changed.ciphertext, "base64");
  cipher[0] ^= 1;
  changed.ciphertext = cipher.toString("base64");
  assert.throws(
    () =>
      api.openArtifactRegistryRetention({
        bytes: Buffer.from(JSON.stringify(changed)),
        binding,
        privateKey: recovered.privateKey,
      }),
    /DECRYPTION_FAILED/u,
  );
});
test("source generation refuses weak, mismatched and colliding public pins", async (t) => {
  for (const pin of [unknown.encryption, { ...recovered.encryption, keyId: "0".repeat(64) }, legacy.encryption])
    await assert.rejects(fixture(t, pin), /REGISTRY_RECIPIENT/u);
});
