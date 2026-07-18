"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { sha256 } = require("../apps/companion/release-governance.cjs");

function option(name, required = false) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  if (required && (!value || value.startsWith("--"))) throw new Error(`${name} is required.`);
  return value;
}

function values(name) {
  const result = [];
  for (let index = 0; index < process.argv.length; index += 1)
    if (process.argv[index] === name && process.argv[index + 1]) result.push(process.argv[index + 1]);
  return result;
}

function boundedArtifact(input) {
  const root = path.resolve("dist");
  const artifact = path.resolve(input);
  if (artifact !== root && !artifact.startsWith(`${root}${path.sep}`))
    throw new Error(`Artifact ${input} is outside the governed dist directory.`);
  const bytes = fs.readFileSync(artifact);
  return {
    path: path.relative(process.cwd(), artifact).replaceAll("\\", "/"),
    filename: path.basename(artifact),
    size: bytes.length,
    sha256: sha256(bytes),
  };
}

function main() {
  const output = path.resolve(option("--output", true));
  const channel = option("--channel", true);
  if (!["development", "creator-preview", "stable"].includes(channel)) throw new Error("Unsupported release channel.");
  const artifacts = values("--artifact").map(boundedArtifact);
  if (!artifacts.length) throw new Error("At least one --artifact is required.");
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const lock = fs.readFileSync("package-lock.json");
  const signatureReportPath = option("--signature-report");
  const signatures = signatureReportPath
    ? JSON.parse(fs.readFileSync(path.resolve(signatureReportPath), "utf8"))
    : { artifacts: artifacts.map((artifact) => ({ path: artifact.path, status: "UNVERIFIED" })) };
  const signed = signatures.artifacts?.every((artifact) => artifact.status === "Valid") === true;
  if (channel !== "development" && !signed) throw new Error(`${channel} provenance requires valid signatures.`);
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  const provenance = {
    schemaVersion: 1,
    releaseVersion: packageJson.version,
    channel,
    source: {
      commit,
      workingTreeClean: status.length === 0,
      dependencyLockSha256: sha256(lock),
      packageManager: packageJson.packageManager,
    },
    build: {
      buildId: process.env.BUILD_ID ?? `local-${commit.slice(0, 12)}`,
      generatedAt: new Date().toISOString(),
      environment: {
        platform: `${os.platform()} ${os.release()} ${os.arch()}`,
        node: process.version,
        cpu: os.cpus()[0]?.model?.trim() ?? "unknown",
      },
    },
    artifacts,
    signing: {
      status: signed ? "SIGNED" : "UNSIGNED_DEVELOPMENT",
      report: signatures.artifacts ?? [],
      identity: signed ? (signatures.artifacts?.[0]?.signerThumbprint ?? null) : null,
    },
    publication: {
      timestamp: null,
      rollbackTarget: option("--rollback-target") ?? null,
    },
  };
  provenance.provenanceHash = `sha256:${sha256(JSON.stringify({ ...provenance, provenanceHash: null }))}`;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(provenance, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  process.stdout.write(`${JSON.stringify({ written: output, hash: provenance.provenanceHash, signed }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({ code: "RELEASE_PROVENANCE_FAILED", message: error.message }, null, 2)}\n`);
  process.exitCode = 1;
}
