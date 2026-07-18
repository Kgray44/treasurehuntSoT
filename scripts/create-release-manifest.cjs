"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { signManifest, validateReleaseManifest } = require("../apps/companion/release-governance.cjs");

function option(name, required = false) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  if (required && (!value || value.startsWith("--"))) throw new Error(`${name} is required.`);
  return value;
}

function main() {
  const provenance = JSON.parse(fs.readFileSync(path.resolve(option("--provenance", true)), "utf8"));
  const output = path.resolve(option("--output", true));
  const channel = option("--channel", true);
  if (channel !== provenance.channel) throw new Error("Manifest channel differs from provenance.");
  const installer =
    provenance.artifacts.find((artifact) => artifact.filename.toLocaleLowerCase().endsWith(".exe")) ??
    provenance.artifacts[0];
  if (!installer) throw new Error("Provenance contains no release artifact.");
  const signedArtifact = provenance.signing.status === "SIGNED";
  const unsigned = {
    schemaVersion: 1,
    releaseVersion: provenance.releaseVersion,
    channel,
    publicationDate: new Date().toISOString(),
    platform: "win32",
    architecture: "x64",
    artifact: {
      location: option("--artifact-location") ?? `artifacts/${installer.filename}`,
      sha256: installer.sha256,
      size: installer.size,
      authenticode: {
        required: channel !== "development",
        status: signedArtifact ? "SIGNED" : "UNSIGNED_DEVELOPMENT",
        signerThumbprint: provenance.signing.identity,
        timestamped: signedArtifact,
      },
    },
    minimumSupportedVersion: option("--minimum-supported-version") ?? "0.7.0-b5",
    compatibility: {
      packageSchemas: [1],
      companionProtocols: ["2.0"],
      modelBundles: ["classical-vision-cpu-1"],
    },
    releaseNotes: [
      "Phase B-6 hardening development build.",
      "Automatic Vision progression remains disabled until real release evidence passes.",
    ],
    rollback: {
      eligible: Boolean(provenance.publication.rollbackTarget),
      targetVersion: provenance.publication.rollbackTarget,
    },
    mandatory: false,
    source: {
      commit: provenance.source.commit,
      buildId: provenance.build.buildId,
      lockHash: provenance.source.dependencyLockSha256,
    },
    manifestSignature: null,
  };
  let manifest = validateReleaseManifest(unsigned);
  const privateKeyPath = process.env.RELEASE_MANIFEST_ED25519_PRIVATE_KEY_PATH;
  if (privateKeyPath) {
    const privateKey = fs.readFileSync(path.resolve(privateKeyPath), "utf8");
    const keyId = process.env.RELEASE_MANIFEST_KEY_ID;
    if (!keyId) throw new Error("RELEASE_MANIFEST_KEY_ID is required when signing metadata.");
    manifest = signManifest(manifest, { keyId, privateKey });
  } else if (channel !== "development") {
    throw new Error(`${channel} manifest signing key is unavailable.`);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  process.stdout.write(
    `${JSON.stringify({ written: output, channel, signed: Boolean(manifest.manifestSignature) }, null, 2)}\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({ code: "RELEASE_MANIFEST_FAILED", message: error.message }, null, 2)}\n`);
  process.exitCode = 1;
}
