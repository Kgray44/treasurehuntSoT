// A transport capability only. Ordinary checkout starts with this route off.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnOwnedProcess, processExit, stopOwnedProcess } from "./owned-process.mjs";
import { retainCustodyProofFrame, readCustodyPilotSource } from "./noncampaign-custody-proof-files.mjs";
import { custodyProbeEnvironment } from "./ordinary-custody-probe.mjs";
import { observeNoncampaignCustodyShadow, inspectNoncampaignCustodyShadow } from "./noncampaign-custody-shadow.mjs";

export const NONCAMPAIGN_CUSTODY_CERTIFICATE_REVISION = "acbd196aef5341e13a2f88509ab88f8b015af44b";
export const CERTIFIED_CUSTODY_PROFILE = "NONCAMPAIGN_CUSTODY_METADATA_V1";
const capabilities = new WeakMap();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const gitBlob = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const oid = (value) => typeof value === "string" && value.length === 40 && /^[a-f0-9]{40}$/u.test(value);
const full = (reason) => ({
  applied: false,
  proposal: Object.freeze({ profile: "FULL_SNAPSHOT", reason, qualification: false }),
});

// These are the native-observed 84 installed source files, plus the new adapter
// and proof worker. The worker independently checks their actual descriptors,
// Git identities and reviewed ancestry; callers cannot supply this list.
export const custodyCertificatePaths = Object.freeze([
  ".gitattributes",
  ".github/workflows/sounding-line-custody-shadow.yml",
  ".nvmrc",
  "package.json",
  "scripts/sounding-line/attestation-archive-shadow.mjs",
  "scripts/sounding-line/authenticated-completed-evidence.mjs",
  "scripts/sounding-line/browser-authority.mjs",
  "scripts/sounding-line/browser-diagnostics.mjs",
  "scripts/sounding-line/browser-suite-profiles.mjs",
  "scripts/sounding-line/custody-transport.mjs",
  "scripts/sounding-line/development-failure-evidence.mjs",
  "scripts/sounding-line/evidence.mjs",
  "scripts/sounding-line/experience-attestation.mjs",
  "scripts/sounding-line/experience-browser.mjs",
  "scripts/sounding-line/experience-checkout-hydration.mjs",
  "scripts/sounding-line/experience-checkout-roots.mjs",
  "scripts/sounding-line/experience-current-admission.mjs",
  "scripts/sounding-line/experience-current-observability.mjs",
  "scripts/sounding-line/experience-current-r16.mjs",
  "scripts/sounding-line/experience-current-r17.mjs",
  "scripts/sounding-line/experience-current-r18.mjs",
  "scripts/sounding-line/experience-current-r19.mjs",
  "scripts/sounding-line/experience-current-r20.mjs",
  "scripts/sounding-line/experience-current-r21.mjs",
  "scripts/sounding-line/experience-current-r22.mjs",
  "scripts/sounding-line/experience-current-r23.mjs",
  "scripts/sounding-line/experience-current-r24.mjs",
  "scripts/sounding-line/experience-current-r25.mjs",
  "scripts/sounding-line/experience-current-r26.mjs",
  "scripts/sounding-line/experience-diagnosed-continuation.mjs",
  "scripts/sounding-line/experience-exception.mjs",
  "scripts/sounding-line/experience-media-first-binding.mjs",
  "scripts/sounding-line/experience-media-first-r21.mjs",
  "scripts/sounding-line/experience-media-first-r22-policy.mjs",
  "scripts/sounding-line/experience-media-first-r22.mjs",
  "scripts/sounding-line/experience-media-first-shared.mjs",
  "scripts/sounding-line/experience-paired.mjs",
  "scripts/sounding-line/experience-pr776-checkout-profile.mjs",
  "scripts/sounding-line/experience-pr776-controller-reconciliation.mjs",
  "scripts/sounding-line/experience-r10.mjs",
  "scripts/sounding-line/experience-r11.mjs",
  "scripts/sounding-line/experience-r12.mjs",
  "scripts/sounding-line/experience-r13.mjs",
  "scripts/sounding-line/experience-r14-observability.mjs",
  "scripts/sounding-line/experience-r14-technical-proof.mjs",
  "scripts/sounding-line/experience-r14.mjs",
  "scripts/sounding-line/experience-r3.mjs",
  "scripts/sounding-line/experience-r4.mjs",
  "scripts/sounding-line/experience-r5.mjs",
  "scripts/sounding-line/experience-r6.mjs",
  "scripts/sounding-line/experience-r7.mjs",
  "scripts/sounding-line/experience-r8-format.mjs",
  "scripts/sounding-line/experience-r8.mjs",
  "scripts/sounding-line/experience-r9.mjs",
  "scripts/sounding-line/experience-raw-output.mjs",
  "scripts/sounding-line/experience-review-dimensions.mjs",
  "scripts/sounding-line/experience-review-source-gate.mjs",
  "scripts/sounding-line/experience-reviewed-adoption.mjs",
  "scripts/sounding-line/experience-scope-adjudication.mjs",
  "scripts/sounding-line/experience-selected-checkout.mjs",
  "scripts/sounding-line/homeport-source-amendment.mjs",
  "scripts/sounding-line/immutable-recognition-reads.mjs",
  "scripts/sounding-line/noncampaign-custody-matched-pilot.mjs",
  "scripts/sounding-line/noncampaign-custody-negative-probe.mjs",
  "scripts/sounding-line/noncampaign-custody-pilot.mjs",
  "scripts/sounding-line/noncampaign-custody-proof-files.mjs",
  "scripts/sounding-line/noncampaign-custody-read-set.mjs",
  "scripts/sounding-line/noncampaign-custody-shadow.mjs",
  "scripts/sounding-line/ordinary-checkout.mjs",
  "scripts/sounding-line/ordinary-custody-probe.mjs",
  "scripts/sounding-line/ordinary-documentation-checkout-profile.mjs",
  "scripts/sounding-line/ordinary.mjs",
  "scripts/sounding-line/owned-process-linux.py",
  "scripts/sounding-line/owned-process-windows.ps1",
  "scripts/sounding-line/owned-process.mjs",
  "scripts/sounding-line/preparation-phases.mjs",
  "scripts/sounding-line/private-browser-failure-output.mjs",
  "scripts/sounding-line/private-browser-failure-publication.mjs",
  "scripts/sounding-line/private-browser-failure.mjs",
  "scripts/sounding-line/product-experience.mjs",
  "scripts/sounding-line/replay-admission-source-diagnostic.mjs",
  "scripts/sounding-line/replay-posttechnical-diagnostic.mjs",
  "scripts/sounding-line/replay-posttechnical-suite.mjs",
  "scripts/sounding-line/source-diagnostics.mjs",
  "scripts/sounding-line/source-snapshot-batches.mjs",
  "scripts/sounding-line/verification-budget.mjs",
  "scripts/sounding-line/verification-diagnostics.mjs",
  "testing/noncampaign-custody-shadow-readers.json",
]);

export function normalizeCustodyCertificateSource(filename, bytes) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  let expression, replacement;
  if (filename === "scripts/sounding-line/noncampaign-custody-read-set.mjs") {
    expression = /^export const NONCAMPAIGN_CUSTODY_CERTIFICATE_REVISION = "(?:PENDING|[a-f0-9]{40})";$/gmu;
    replacement = 'export const NONCAMPAIGN_CUSTODY_CERTIFICATE_REVISION = "PENDING";';
  } else if (filename === "scripts/sounding-line/ordinary-checkout.mjs") {
    expression = /^export const NONCAMPAIGN_CUSTODY_CHECKOUT_MODE = "(?:SHADOW|ACTIVE)";$/gmu;
    replacement = 'export const NONCAMPAIGN_CUSTODY_CHECKOUT_MODE = "SHADOW";';
  } else return Buffer.from(bytes);
  if ([...text.matchAll(expression)].length !== 1) throw Error("CUSTODY_CERTIFICATE_TOKEN_INVALID");
  return Buffer.from(text.replace(expression, replacement));
}

export function custodySwitchAlternate(bytes) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const expression = /^export const NONCAMPAIGN_CUSTODY_CHECKOUT_MODE = "(SHADOW|ACTIVE)";$/gmu;
  const matches = [...text.matchAll(expression)];
  if (matches.length !== 1 || bytes.length > 16384) throw Error("CUSTODY_SWITCH_TOKEN_INVALID");
  return Buffer.from(
    text.replace(
      expression,
      `export const NONCAMPAIGN_CUSTODY_CHECKOUT_MODE = "${matches[0][1] === "SHADOW" ? "ACTIVE" : "SHADOW"}";`,
    ),
  );
}

// Data validation only; this cannot issue an opaque transport capability.
export function verifyCustodySwitchReader({ installedBytes, candidateBytes, mode, blob, revision }) {
  if (
    !Buffer.isBuffer(installedBytes) ||
    !Buffer.isBuffer(candidateBytes) ||
    mode !== "100644" ||
    !oid(blob) ||
    !oid(revision)
  )
    throw Error("CUSTODY_SWITCH_READER_INVALID");
  const expected = custodySwitchAlternate(installedBytes);
  if (
    candidateBytes.length !== expected.length ||
    !candidateBytes.equals(expected) ||
    gitBlob(candidateBytes) !== blob ||
    gitBlob(expected) !== blob
  )
    throw Error("CUSTODY_SWITCH_READER_INVALID");
  return Object.freeze({ revision, path: "scripts/sounding-line/ordinary-checkout.mjs", blob });
}

// Only the real installed worker can mint a capability. A supplied callback,
// boolean, serialized observation or mocked JSON result is never accepted here.
export async function certifiedNoncampaignCustodyReadSet({
  root,
  git,
  baseSha,
  candidateSha,
  prNumber,
  roots,
  signal,
  binaryCommand,
  readOnlyBinaryCommand,
}) {
  if (signal?.aborted) throw Error("SOUNDING_LINE_SELECTED_CHECKOUT_CANCELLED");
  if (!Number.isSafeInteger(prNumber) || prNumber < 1 || [721, 776, 805, 820].includes(prNumber))
    return full("HELD_OR_UNBOUND_OWNER");
  if (!oid(baseSha) || !oid(candidateSha) || !oid(NONCAMPAIGN_CUSTODY_CERTIFICATE_REVISION))
    return full("REVIEWED_SOURCE_UNAVAILABLE");
  if (
    typeof root !== "string" ||
    !path.isAbsolute(root) ||
    typeof git !== "string" ||
    !path.isAbsolute(git) ||
    !Array.isArray(roots) ||
    roots.length > 32 ||
    !roots.every(oid)
  )
    return full("PROOF_CONTEXT_UNAVAILABLE");
  if (typeof binaryCommand !== "function" || typeof readOnlyBinaryCommand !== "function")
    return full("BINARY_CONTEXT_UNAVAILABLE");
  try {
    if (
      fs.realpathSync.native(root) !== root ||
      fs.realpathSync.native(path.join(root, ".git")) !== path.join(root, ".git")
    )
      return full("NONCANONICAL_PROOF_CONTEXT");
  } catch {
    return full("NONCANONICAL_PROOF_CONTEXT");
  }
  let observation;
  try {
    await binaryCommand(["merge-base", "--is-ancestor", NONCAMPAIGN_CUSTODY_CERTIFICATE_REVISION, baseSha]);
    observation = await observeNoncampaignCustodyShadow({
      root,
      git,
      baseSha,
      candidateSha,
      prNumber,
      command: binaryCommand,
      readOnlyCommand: readOnlyBinaryCommand,
    });
  } catch (error) {
    if (error.code === "EEXIST") return full("ORIGINAL_PROOF_PREFIX_ALREADY_PRESENT");
    if (/^SOUNDING_LINE_SELECTED_CHECKOUT_(?:GIT_FAILED|PROBE_DEADLINE)$/u.test(error.message))
      return full("REVIEWED_SOURCE_OR_HINT_UNAVAILABLE");
    throw error;
  }
  const shadowProof = inspectNoncampaignCustodyShadow(observation.shadowObservation, { root, baseSha, candidateSha });
  if (!shadowProof) return full(observation.proposal?.reason ?? "NEGATIVE_OBSERVATION_UNAVAILABLE");
  const certificateReaders = [];
  const switchPath = "scripts/sounding-line/ordinary-checkout.mjs";
  const installedSwitch = readCustodyPilotSource(fileURLToPath(new URL("./ordinary-checkout.mjs", import.meta.url)));
  const treeBytes = await binaryCommand(["ls-tree", "-z", candidateSha, "--", switchPath]);
  if (!Buffer.isBuffer(treeBytes)) return full("SWITCH_METADATA_UNAVAILABLE");
  let tree;
  try {
    tree = new TextDecoder("utf-8", { fatal: true }).decode(treeBytes);
  } catch (error) {
    if (error.code === "ERR_ENCODING_INVALID_ENCODED_DATA") return full("SWITCH_METADATA_UNAVAILABLE");
    throw error;
  }
  const match = /^100644 blob ([a-f0-9]{40})\tscripts\/sounding-line\/ordinary-checkout\.mjs\0$/u.exec(tree);
  if (!match) return full("SWITCH_METADATA_UNAVAILABLE");
  if (match[1] !== gitBlob(installedSwitch)) {
    const expected = custodySwitchAlternate(installedSwitch),
      blob = gitBlob(expected);
    if (match[1] !== blob) return full("CANDIDATE_TRANSPORT_CHANGED");
    try {
      await binaryCommand([
        "fetch",
        "--filter=blob:none",
        "--no-tags",
        "--no-recurse-submodules",
        "--no-write-fetch-head",
        "origin",
        blob,
      ]);
    } catch (error) {
      if (error.message === "SOUNDING_LINE_SELECTED_CHECKOUT_GIT_FAILED")
        return full("CANDIDATE_SWITCH_BYTES_UNAVAILABLE");
      throw error;
    }
    certificateReaders.push(Object.freeze({ revision: candidateSha, path: switchPath, blob }));
  }
  Object.freeze(certificateReaders);
  const directory = path.join(root, ".git/noncampaign-custody-proof");
  try {
    fs.mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error.code === "EEXIST") return full("ORIGINAL_PROOF_PREFIX_ALREADY_PRESENT");
    throw error;
  }
  const input = path.join(directory, "input.original.json");
  retainCustodyProofFrame(input, Buffer.from(JSON.stringify({ root, git, baseSha, candidateSha, prNumber, roots })));
  const emptyConfig = path.join(directory, "empty-git-config");
  retainCustodyProofFrame(emptyConfig, Buffer.alloc(0));
  const environment = custodyProbeEnvironment({ ...process.env, GIT_CONFIG_GLOBAL: emptyConfig }, git);
  const child = spawnOwnedProcess(
    process.execPath,
    [fileURLToPath(new URL("./noncampaign-custody-negative-probe.mjs", import.meta.url)), input],
    {
      root,
      env: environment,
      cleanupOptions: { gracefulMs: 500, forceMs: 1000 },
    },
  );
  child.stdout.unpipe(process.stdout);
  child.stderr.unpipe(process.stderr);
  const frames = { stdout: [], stderr: [] },
    observed = { stdout: 0, stderr: 0 },
    stored = { stdout: 0, stderr: 0 };
  let timer, abort, failure, cleanup, result, rejectFailure;
  const capture = (kind, bytes) => {
    observed[kind] += bytes.length;
    const keep = bytes.subarray(0, Math.max(0, 1024 ** 2 - stored[kind]));
    if (keep.length) frames[kind].push(keep);
    stored[kind] += keep.length;
    if (observed[kind] > 1024 ** 2) rejectFailure?.(Error("CUSTODY_WORKER_OUTPUT_BOUND"));
  };
  child.stdout.on("data", (bytes) => capture("stdout", bytes));
  child.stderr.on("data", (bytes) => capture("stderr", bytes));
  child.stdout.resume();
  child.stderr.resume();
  try {
    result = await Promise.race([
      processExit(child),
      new Promise((_, reject) => {
        rejectFailure = reject;
        timer = setTimeout(() => reject(Error("CUSTODY_WORKER_DEADLINE")), 60000);
        abort = () => reject(Error("SOUNDING_LINE_SELECTED_CHECKOUT_CANCELLED"));
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
        if (Object.values(observed).some((size) => size > 1024 ** 2)) reject(Error("CUSTODY_WORKER_OUTPUT_BOUND"));
      }),
    ]);
  } catch (error) {
    failure = error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    const errors = [];
    try {
      cleanup = await stopOwnedProcess(child);
    } catch (error) {
      errors.push(error);
    }
    for (const kind of ["stdout", "stderr"])
      try {
        retainCustodyProofFrame(path.join(directory, `worker.original.${kind}`), Buffer.concat(frames[kind]));
      } catch (error) {
        errors.push(error);
      }
    try {
      retainCustodyProofFrame(
        path.join(directory, "supervision.json"),
        Buffer.from(
          JSON.stringify({
            result,
            cleanup,
            observed,
            stored,
            originalExceptionSerializationComplete: false,
            qualification: false,
          }),
        ),
      );
    } catch (error) {
      errors.push(error);
    }
    if (errors.length)
      throw new AggregateError([...(failure ? [failure] : []), ...errors], "CUSTODY_WORKER_AND_RETENTION_FAILED", {
        cause: failure ?? errors[0],
      });
  }
  if (signal?.aborted || failure?.message === "SOUNDING_LINE_SELECTED_CHECKOUT_CANCELLED")
    throw failure ?? Error("SOUNDING_LINE_SELECTED_CHECKOUT_CANCELLED");
  if (cleanup?.status !== "PASS" || !cleanup.treeReaped || !cleanup.streamsClosed)
    throw new AggregateError(
      [...(failure ? [failure] : []), Error("CUSTODY_WORKER_CLEANUP_FAILED")],
      "CUSTODY_WORKER_CLEANUP_FAILED",
      { cause: failure },
    );
  if (
    failure ||
    result?.code !== 0 ||
    result.supervisionFailure ||
    observed.stdout !== stored.stdout ||
    observed.stderr !== stored.stderr
  )
    return full("INSTALLED_NEGATIVE_PROOF_UNAVAILABLE");
  let proof;
  try {
    proof = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(frames.stdout)));
  } catch {
    return full("INSTALLED_NEGATIVE_PROOF_UNAVAILABLE");
  }
  if (!proof || typeof proof !== "object") return full("INSTALLED_NEGATIVE_PROOF_UNAVAILABLE");
  const proposal = {
    ...shadowProof.proposal,
    profile: CERTIFIED_CUSTODY_PROFILE,
    applied: true,
    sourceCertificate: "REVIEWED_INSTALLED_TRANSPORT_ONLY",
    qualification: false,
  };
  if (
    proof.status !== "PASS_INSTALLED_NEGATIVE_CUSTODY" ||
    proof.root !== root ||
    proof.baseSha !== baseSha ||
    proof.candidateSha !== candidateSha ||
    proof.prNumber !== prNumber ||
    proof.certificateRevision !== NONCAMPAIGN_CUSTODY_CERTIFICATE_REVISION ||
    proof.profile !== CERTIFIED_CUSTODY_PROFILE ||
    proof.proposalSha256 !== hash(Buffer.from(JSON.stringify(proposal))) ||
    JSON.stringify(proof.certificateReaders) !== JSON.stringify(certificateReaders) ||
    proof.networkAttempts !== 0 ||
    proof.nonGitProcessAttempts !== 0 ||
    proof.fetchAttempts !== 0 ||
    proof.completeCommitTreeAncestry !== true ||
    proof.filesystemUnchanged !== true ||
    proof.reserveOutputSha256 !== "9ed5fac5b53bc194a2b97ea716ef041145b9cb12844a1a2642c33d6af6905445" ||
    JSON.stringify(proof.roots) !== JSON.stringify(roots)
  )
    return full("INSTALLED_NEGATIVE_PROOF_UNAVAILABLE");
  for (const row of proposal.omissions) Object.freeze(row);
  for (const key of ["omissions", "metadataPaths", "changedPaths"]) Object.freeze(proposal[key]);
  Object.freeze(proposal);
  const receipt = Object.freeze({
    certificateRevision: proof.certificateRevision,
    installedSourceDigest: proof.installedSourceDigest,
    reserveOutputSha256: proof.reserveOutputSha256,
    proofSha256: hash(Buffer.concat(frames.stdout)),
    qualification: false,
  });
  const value = Object.freeze({ applied: true, proposal, certificateReaders, transportSourceProof: receipt });
  capabilities.set(value, {
    root,
    baseSha,
    candidateSha,
    roots: JSON.stringify(roots),
    proposal,
    certificateReaders,
    receipt,
  });
  return value;
}

export function inspectCertifiedCustodyReadSet(value, { root, baseSha, candidateSha, roots }) {
  const proof = capabilities.get(value);
  if (
    !proof ||
    proof.root !== root ||
    proof.baseSha !== baseSha ||
    proof.candidateSha !== candidateSha ||
    proof.roots !== JSON.stringify(roots)
  )
    return null;
  return Object.freeze({
    proposal: proof.proposal,
    certificateReaders: proof.certificateReaders,
    transportSourceProof: proof.receipt,
    qualification: false,
  });
}
