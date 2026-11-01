// Bounded local custody adapter. No provider or runtime authentication is minted.
import path from "node:path";
import { constants, lstat, open, opendir, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { canonicalJson } from "./evidence.mjs";
import { readBoundedRawCaptureFile } from "./experience-raw-output.mjs";
import { buildClosedContextRegistryShadow } from "./closed-context-registry-producer.mjs";
import { shadowCaptureContextSchedule } from "./experience-browser.mjs";
import { sealArtifactRegistryRetention } from "./artifact-registry-retention.mjs";
const need = (value, code) => {
  if (!value) throw Error(`SOUNDING_LINE_CONTEXT_REGISTRY_FILES_${code}`);
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function readBoundedRegistryFile({ root, file, maximumBytes }) {
  root = await realpath(root);
  need(
    typeof file === "string" &&
      !/[\\:\u0000-\u001f\u007f]/u.test(file) &&
      !file.startsWith("/") &&
      file.split("/").every((part) => part && part !== "." && part !== ".."),
    "PATH",
  );
  need(Number.isSafeInteger(maximumBytes) && maximumBytes > 0 && maximumBytes <= 2 * 1024 * 1024, "BOUND");
  let selected = root;
  const parts = file.split("/");
  for (const [i, part] of parts.entries()) {
    selected = path.join(selected, part);
    const stat = await lstat(selected);
    need(
      !stat.isSymbolicLink() &&
        (i === parts.length - 1
          ? stat.isFile() && stat.nlink === 1 && !(stat.mode & 0o111) && stat.size <= maximumBytes
          : stat.isDirectory()),
      "OWNED_FILE",
    );
  }
  need((await realpath(selected)) === selected, "OWNED_FILE");
  const handle = await open(selected, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat(),
      buffer = Buffer.alloc(maximumBytes + 1);
    need(before.isFile() && before.nlink === 1 && before.size <= maximumBytes, "BOUND");
    let count = 0;
    while (count < buffer.length) {
      const { bytesRead } = await handle.read(buffer, count, buffer.length - count, null);
      if (!bytesRead) break;
      count += bytesRead;
    }
    const after = await handle.stat(),
      named = await lstat(selected);
    need(
      count === before.size &&
        count <= maximumBytes &&
        !named.isSymbolicLink() &&
        [after, named].every(
          (value) =>
            value.isFile() &&
            value.nlink === 1 &&
            ["ino", "dev", "size", "mtimeMs", "ctimeMs"].every((key) => value[key] === before[key]),
        ),
      "FILE_CHANGED",
    );
    need((await realpath(selected)) === selected, "FILE_CHANGED");
    return Buffer.from(buffer.subarray(0, count));
  } finally {
    await handle.close();
  }
}
async function journalPaths(root, directory) {
  const result = [];
  let entries = 0;
  async function visit(relative, nested) {
    const full = path.resolve(root, relative),
      stat = await lstat(full);
    need(
      full.startsWith(root + path.sep) &&
        stat.isDirectory() &&
        !stat.isSymbolicLink() &&
        (await realpath(full)) === full,
      "JOURNAL_DIRECTORY",
    );
    const handle = await opendir(full);
    for await (const entry of handle) {
      need(++entries <= 256 && !entry.isSymbolicLink(), "JOURNAL_BOUND");
      if (entry.isDirectory()) {
        need(!nested && /^[a-f0-9]{64}$/u.test(entry.name), "JOURNAL_DIRECTORY");
        await visit(`${relative}/${entry.name}`, true);
      } else {
        need(entry.isFile() && /^[a-f0-9]{64}\.json$/u.test(entry.name) && result.length < 128, "JOURNAL_MEMBER");
        result.push(`${relative}/${entry.name}`);
      }
    }
  }
  await visit(directory, false);
  return result.sort();
}
export async function readRegistryRuntimeCleanups({ root, plan, cleanupPaths }) {
  shadowCaptureContextSchedule(plan);
  root = await realpath(root);
  const profiles = [...new Set(plan.contracts.map((value) => value.experience.fixtureProfile ?? "generic"))];
  need(
    Array.isArray(cleanupPaths) &&
      cleanupPaths.length > 0 &&
      cleanupPaths.length <= 16 &&
      cleanupPaths.length === profiles.length &&
      new Set(cleanupPaths).size === cleanupPaths.length,
    "CLEANUP_PROFILES",
  );
  const cleanups = [];
  const uuid = "[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}";
  const pattern = new RegExp(
    "^artifacts/sounding-line/browser-diagnostics/(" + uuid + ")/(" + uuid + ")/browser-runtime[.]json$",
    "u",
  );
  for (const cleanupPath of cleanupPaths) {
    const match = pattern.exec(cleanupPath ?? "");
    need(match, "CLEANUP_SCOPE");
    const cleanupBytes = await readBoundedRegistryFile({ root, file: cleanupPath, maximumBytes: 1024 * 1024 });
    const runtime = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(cleanupBytes));
    const cleanup = runtime.lifecycle?.cleanup,
      binding = runtime.diagnosticBinding;
    need(
      binding?.version === 1 &&
        binding.runId === match[1] &&
        binding.scopeId === match[2] &&
        binding.baseSha === plan.baseSha &&
        binding.candidateSha === plan.candidateSha &&
        /^[a-f0-9]{64}$/u.test(binding.planDigest ?? ""),
      "RUNTIME_BINDING",
    );
    const profileBytes = await readBoundedRegistryFile({
      root,
      file: cleanupPath.replace(/browser-runtime[.]json$/u, "browser-suite-profile.json"),
      maximumBytes: 1024 * 1024,
    });
    const profile = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(profileBytes));
    need(
      profile.version === 1 &&
        profiles.includes(profile.profile) &&
        !cleanups.some((value) => value.fixtureProfile === profile.profile) &&
        canonicalJson(profile.diagnosticBinding) === canonicalJson(binding),
      "PROFILE_RUNTIME_BINDING",
    );
    need(
      cleanup?.status === "PASS" &&
        cleanup.portsReleased === true &&
        ["browser", "server"].every(
          (role) =>
            cleanup[role]?.status === "PASS" &&
            cleanup[role].treeReaped === true &&
            cleanup[role].streamsClosed === true,
        ) &&
        ["fixture", "proxy"].every((role) => ["PASS", "NOT_STARTED"].includes(cleanup[role]?.status)),
      "CLEANUP_INCOMPLETE",
    );
    cleanups.push({
      fixtureProfile: profile.profile,
      profileReceiptSha256: hash(profileBytes),
      bytes: cleanupBytes,
      path: cleanupPath.slice("artifacts/sounding-line/".length),
      processTreeClosed: true,
      portsClosed: true,
      streamsClosed: true,
    });
  }
  return cleanups;
}
export async function sealClosedContextRegistryFiles({
  root,
  rawDirectory,
  cleanupPath,
  cleanupPaths = [cleanupPath],
  ...input
}) {
  shadowCaptureContextSchedule(input.plan);
  root = await realpath(root);
  need(
    /^artifacts\/sounding-line\/product-experience-capture-staging\/capture-[A-Za-z0-9_-]+\/raw$/u.test(
      rawDirectory ?? "",
    ),
    "RAW_SCOPE",
  );
  const cleanups = await readRegistryRuntimeCleanups({ root, plan: input.plan, cleanupPaths });
  const contexts = [],
    failedContextObservations = [],
    paths = await journalPaths(root, `${rawDirectory}/closed-contexts`),
    seenPaths = new Set();
  let metadataBytes = 0,
    mediaBytes = 0;
  let firstFailure;
  for (const file of paths) {
    let bytes;
    try {
      bytes = await readBoundedRawCaptureFile({ root, rawDirectory, file, maximumBytes: 2 * 1024 * 1024 });
      need((metadataBytes += bytes.length) <= 64 * 1024 * 1024, "METADATA_BOUND");
      const journal = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      need(Array.isArray(journal.rawFiles) && journal.rawFiles.length <= 512, "MEDIA_BOUND");
      for (const descriptor of journal.rawFiles) {
        need(
          typeof descriptor.path === "string" &&
            descriptor.path.startsWith(rawDirectory + "/") &&
            !seenPaths.has(descriptor.path) &&
            seenPaths.size < 8192 &&
            Number.isSafeInteger(descriptor.bytes) &&
            descriptor.bytes > 0 &&
            descriptor.bytes <= 64 * 1024 * 1024 &&
            /^[a-f0-9]{64}$/u.test(descriptor.sha256 ?? ""),
          "MEDIA_BINDING",
        );
        seenPaths.add(descriptor.path);
        mediaBytes += descriptor.bytes;
        need(mediaBytes <= 256 * 1024 * 1024, "MEDIA_BOUND");
        const original = await readBoundedRawCaptureFile({
          root,
          rawDirectory,
          file: descriptor.path,
          maximumBytes: descriptor.bytes,
        });
        need(original.length === descriptor.bytes && hash(original) === descriptor.sha256, "MEDIA_CHANGED");
      }
      const named = await lstat(path.join(root, file));
      const observation = { journal, bytes, path: file, completedAt: named.mtime.toISOString() };
      buildClosedContextRegistryShadow({ ...input, contexts: [observation], cleanup: cleanups });
      const reread = await readBoundedRawCaptureFile({ root, rawDirectory, file, maximumBytes: 2 * 1024 * 1024 });
      need(reread.equals(bytes), "JOURNAL_CHANGED");
      contexts.push(observation);
    } catch (error) {
      if (/SOUNDING_LINE_CONTEXT_REGISTRY_FILES_(?:MEDIA|METADATA)_BOUND$/u.test(error?.message ?? "")) throw error;
      firstFailure ??= error;
      const code = /^(?:SOUNDING_LINE|PRODUCT_EXPERIENCE)_[A-Z0-9_]+$/u.test(error?.message ?? "")
        ? error.message
        : "INCOMPLETE_JOURNAL";
      failedContextObservations.push({
        path: file,
        bytes: bytes?.length ?? null,
        sha256: bytes ? hash(bytes) : null,
        code,
        disposition: "ORIGINAL_RAW_RETAINED_NO_CREDIT",
      });
    }
  }
  if (!contexts.length && firstFailure) throw firstFailure;
  const registry = buildClosedContextRegistryShadow({
    ...input,
    contexts,
    failedContextObservations,
    cleanup: cleanups,
  });
  const binding = {
    repository: input.producer.repository,
    prNumber: input.plan.prNumber,
    runId: input.producer.runId,
    attempt: input.producer.attempt,
    baseSha: input.plan.baseSha,
    candidateSha: input.plan.candidateSha,
    jobKey: "experience-preparation",
    sourceBindingsDigest: input.plan.sourceDigest,
  };
  const encrypted = sealArtifactRegistryRetention({
    manifest: registry.manifest,
    binding,
    validation: { expectedCoverage: registry.expectedCoverage },
  });
  return {
    encrypted,
    manifestDigest: registry.manifest.manifestDigest,
    completedContexts: registry.manifest.completedContexts.length,
    artifactCount: registry.manifest.artifacts.length,
    failedContextObservations: failedContextObservations.length,
    metadataBytes,
    mediaBytes,
    qualification: false,
    reuseAuthorized: false,
  };
}
