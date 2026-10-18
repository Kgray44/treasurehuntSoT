// UNEXECUTED development harness. Never launches a browser, reserves custody,
// fetches an artifact, modifies a repository, or supplies product acceptance.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  chmod,
  constants,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const canonical = "Development_Docs/Testing/Product_Experience/evidence";
const registryPath = "testing/product-experience-exceptions.json";
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const relative = (root, file) =>
  path.relative(root, file).split(path.sep).join("/");
const requireValue = (value, code) =>
  assert(value, `ACTUAL_OUTPUT_DIAGNOSTIC_${code}`);
function safe(file) {
  requireValue(
    typeof file === "string" &&
      file &&
      !/[\\:\u0000-\u001f\u007f]/u.test(file) &&
      !path.posix.isAbsolute(file) &&
      file.split("/").every((p) => p && p !== "." && p !== ".."),
    "PATH_INVALID",
  );
  return file;
}
async function owned(root, file) {
  safe(file);
  let current = root;
  for (const part of file.split("/")) {
    current = path.join(current, part);
    const stat = await lstat(current);
    requireValue(
      !stat.isSymbolicLink() &&
        (current === path.join(root, file) || stat.isDirectory()),
      "SYMLINK_OR_PARENT_TYPE",
    );
  }
  return current;
}
async function fingerprint(file) {
  const before = await lstat(file);
  requireValue(
    before.isFile() && !before.isSymbolicLink() && !(before.mode & 0o7111),
    "REGULAR_NONEXEC_REQUIRED",
  );
  const sha = createHash("sha256"),
    blob = createHash("sha1").update(`blob ${before.size}\0`);
  for await (const chunk of createReadStream(file, {
    highWaterMark: 1024 * 1024,
  })) {
    sha.update(chunk);
    blob.update(chunk);
  }
  const after = await lstat(file);
  requireValue(
    ["dev", "ino", "size", "mtimeMs", "ctimeMs"].every(
      (key) => before[key] === after[key],
    ),
    "INPUT_CHANGED",
  );
  return {
    bytes: before.size,
    sha256: sha.digest("hex"),
    blob: blob.digest("hex"),
    permissions: before.mode & 0o777,
  };
}
async function tree(root, prefix = "") {
  const files = {};
  async function visit(directory) {
    for (const entry of (
      await readdir(path.join(root, directory), { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = directory ? `${directory}/${entry.name}` : entry.name;
      await owned(root, file);
      if (entry.isDirectory()) await visit(file);
      else files[file] = await fingerprint(path.join(root, file));
    }
  }
  try {
    await lstat(path.join(root, prefix));
  } catch (error) {
    if (error.code === "ENOENT") return files;
    throw error;
  }
  await visit(prefix);
  return files;
}
async function copyExact(source, destination) {
  const before = await fingerprint(source);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination, constants.COPYFILE_EXCL);
  await chmod(destination, before.permissions);
  assert.deepEqual(await fingerprint(destination), before);
  assert.deepEqual(await fingerprint(source), before);
}
const cleanEnv = {
  ...process.env,
  GIT_NO_LAZY_FETCH: "1",
  GIT_OPTIONAL_LOCKS: "0",
};
for (const key of [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "GITHUB_OUTPUT",
  "GITHUB_ACTIONS",
  "GITHUB_RUN_ID",
  "GITHUB_RUN_ATTEMPT",
])
  delete cleanEnv[key];
const git = (root, args, extra = {}) =>
  execFileSync("git", args, {
    cwd: root,
    env: { ...cleanEnv, ...extra },
    maxBuffer: 64 * 1024 * 1024,
  });
async function readJson(root, file) {
  return JSON.parse(await readFile(await owned(root, file), "utf8"));
}
function closure(capture, workingDirectory, record) {
  const jsonPaths = record.currentSourceAdmission.publicationFiles
    .filter((file) => file.startsWith(canonical + "/"))
    .map((file) => workingDirectory + file.slice(canonical.length));
  const media = new Map();
  const ids = new Set();
  for (const artifact of capture.artifacts) {
    safe(artifact.path);
    requireValue(
      artifact.path.startsWith(workingDirectory + "/") && !ids.has(artifact.id),
      "ARTIFACT_PATH_OR_ID",
    );
    ids.add(artifact.id);
    const group = media.get(artifact.path) ?? [];
    group.push(artifact);
    media.set(artifact.path, group);
  }
  return {
    jsonPaths,
    media,
    selected: [...new Set([...jsonPaths, ...media.keys()])].sort(),
  };
}
function tuples(plan) {
  return plan.contracts.flatMap((c) =>
    c.experience.devices.flatMap((device) =>
      c.experience.journeys.flatMap((j) =>
        j.roles.flatMap((role) =>
          (c.experience.motion ? ["NORMAL", "REDUCED"] : ["REDUCED"]).map(
            (motionMode) => ({
              contractId: c.id,
              id: j.id,
              device,
              role,
              motionMode,
            }),
          ),
        ),
      ),
    ),
  );
}

const configPath = process.argv[2];
requireValue(configPath && process.argv.length === 3, "CONFIG_REQUIRED");
const configBytes = await readFile(configPath),
  config = JSON.parse(configBytes);
requireValue(
  config.version === 1 &&
    config.acknowledgement === "ACTUAL_BYTES_PUBLICATION_DIAGNOSTIC_ONLY",
  "ACKNOWLEDGEMENT_REQUIRED",
);
for (const required of [
  config.originalZip?.path,
  config.extraction?.root,
  config.extraction?.manifestPath,
  config.source?.originalAuthorityRoot,
  config.source?.repairAuthorityRoot,
  config.source?.candidateGitDir,
  config.preimageProjectionRoot,
  config.outputRoot,
  config.members?.plan,
  config.members?.capture,
  config.members?.journal,
])
  requireValue(
    typeof required === "string" &&
      required.trim() &&
      !required.includes("PLACEHOLDER"),
    "CONCRETE_INPUTS_REQUIRED",
  );
requireValue(
  /^[a-f0-9]{64}$/u.test(config.extraction.manifestSHA256 ?? ""),
  "PINNED_MANIFEST_REQUIRED",
);
for (const value of [
  config.source.originalAuthoritySha,
  config.source.repairSha,
  config.source.repairTree,
  config.source.candidateTree,
  config.expected?.baseSha,
  config.expected?.candidateSha,
])
  requireValue(/^[a-f0-9]{40}$/u.test(value ?? ""), "SOURCE_SHA_REQUIRED");
for (const value of [
  config.originalZip.sha256,
  config.expected?.sourceDigest,
  config.expected?.contractDigest,
  config.expected?.recordDigest,
  config.expected?.strictPublisherSHA256,
])
  requireValue(/^[a-f0-9]{64}$/u.test(value ?? ""), "SOURCE_DIGEST_REQUIRED");
requireValue(
  /^[a-f0-9]{40}$/u.test(config.expected.preparationReservation ?? ""),
  "ORIGINAL_RESERVATION_REQUIRED",
);
const output = path.resolve(config.outputRoot);
requireValue(
  (await realpath(path.dirname(output))) === path.dirname(output),
  "OUTPUT_PARENT_SYMLINK",
);
for (const input of [
  config.extraction.root,
  config.source.originalAuthorityRoot,
  config.source.repairAuthorityRoot,
  config.source.candidateGitDir,
  config.preimageProjectionRoot,
]) {
  const resolved = path.resolve(input);
  requireValue(
    resolved !== output &&
      !resolved.startsWith(output + path.sep) &&
      !output.startsWith(resolved + path.sep),
    "OUTPUT_INPUT_OVERLAP",
  );
}
for (const input of [
  configPath,
  config.originalZip.path,
  config.extraction.manifestPath,
])
  requireValue(
    !path.resolve(input).startsWith(output + path.sep),
    "OUTPUT_INPUT_FILE_OVERLAP",
  );
await mkdir(output); // One new private run, never overwrite/retry a previous output.
const write = (name, value) =>
  writeFile(path.join(output, name), json(value), { flag: "wx", mode: 0o600 });
await write("configuration.private.json", {
  configPath: path.resolve(configPath),
  bytes: configBytes.length,
  sha256: digest(configBytes),
  configuration: config,
  qualification: false,
  acceptance: false,
});
let finalStatus = "FAIL",
  phase = "INPUT_VERIFICATION";
const phases = [];
try {
  const extractionRoot = await realpath(config.extraction.root);
  requireValue(
    extractionRoot === path.resolve(config.extraction.root),
    "EXTRACTION_ROOT_SYMLINK",
  );
  const zipBefore = await fingerprint(config.originalZip.path);
  requireValue(
    zipBefore.bytes === config.originalZip.bytes &&
      zipBefore.sha256 === config.originalZip.sha256,
    "WHOLE_ORIGINAL_MISMATCH",
  );
  const manifestBytes = await readFile(config.extraction.manifestPath);
  requireValue(
    digest(manifestBytes) === config.extraction.manifestSHA256,
    "MANIFEST_PIN_MISMATCH",
  );
  const manifest = JSON.parse(manifestBytes);
  requireValue(
    manifest.version === 1 &&
      manifest.status === "PASS" &&
      manifest.archive?.bytes === zipBefore.bytes &&
      manifest.archive?.sha256 === zipBefore.sha256 &&
      manifest.checks?.wholeOriginalSHA256 === true &&
      manifest.checks?.centralDirectoryComplete === true &&
      manifest.checks?.allFilesCRCVerified === true &&
      Array.isArray(manifest.files),
    "VERIFIED_INTAKE_PRECONDITION",
  );
  // The intake manifest is a separately pinned trusted intake output, not a self-
  // hashed substitute for ZIP verification. This harness rechecks every extracted byte.
  const inputFiles = new Map();
  for (const file of manifest.files) {
    safe(file.path);
    requireValue(
      !inputFiles.has(file.path) &&
        /^[a-f0-9]{64}$/u.test(file.sha256 ?? "") &&
        /^[a-f0-9]{8}$/u.test(file.crc32 ?? ""),
      "MEMBER_IDENTITY",
    );
    const actual = await fingerprint(await owned(extractionRoot, file.path));
    requireValue(
      actual.bytes === file.bytes && actual.sha256 === file.sha256,
      "EXTRACTED_BYTE_MISMATCH",
    );
    inputFiles.set(file.path, actual);
  }
  const actualExtraction = await tree(extractionRoot);
  assert.deepEqual(
    Object.keys(actualExtraction).sort(),
    [...inputFiles.keys()].sort(),
    "ACTUAL_OUTPUT_DIAGNOSTIC_UNLISTED_EXTRACTED_FILE",
  );
  const plan = await readJson(extractionRoot, config.members.plan),
    capture = await readJson(extractionRoot, config.members.capture),
    originalJournal = await readJson(extractionRoot, config.members.journal);
  const workingDirectory = safe(originalJournal.workingDirectory);
  requireValue(
    /^artifacts\/sounding-line\/product-experience-capture-staging\/capture-[A-Za-z0-9_-]+\/capture$/u.test(
      workingDirectory,
    ),
    "ORIGINAL_SCOPE_REQUIRED",
  );
  requireValue(
    originalJournal.status === "FAILED" &&
      originalJournal.error?.includes(
        "PRODUCT_EXPERIENCE_CAPTURE_PUBLICATION_UNREFERENCED_OUTPUT",
      ) &&
      !originalJournal.attempted?.length &&
      !originalJournal.promoted?.length,
    "ORIGINAL_FAILURE_NOT_CONFIRMED",
  );
  const stageMember = path.posix.dirname(config.members.capture);
  const stageFiles = [...inputFiles.keys()].filter((file) =>
    file.startsWith(stageMember + "/"),
  );
  const sourceStage = new Map(
    stageFiles.map((file) => [
      workingDirectory + file.slice(stageMember.length),
      file,
    ]),
  );
  requireValue(
    sourceStage.has(`${workingDirectory}/capture.json`),
    "ORIGINAL_CAPTURE_REQUIRED",
  );
  const source = config.source;
  const authorityPins = [];
  for (const [root, sha] of [
    [source.originalAuthorityRoot, source.originalAuthoritySha],
    [source.repairAuthorityRoot, source.repairSha],
  ]) {
    requireValue(
      git(root, ["rev-parse", "HEAD"]).toString().trim() === sha,
      "AUTHORITY_HEAD_MISMATCH",
    );
    const paths = git(root, [
      "ls-tree",
      "-r",
      "-z",
      sha,
      "--",
      "scripts/sounding-line",
    ])
      .toString()
      .split("\0")
      .filter(Boolean);
    for (const entry of paths) {
      const match = /^100644 blob ([a-f0-9]{40})\t(.+)$/u.exec(entry);
      requireValue(match, "AUTHORITY_SOURCE_MODE");
      const pin = await fingerprint(await owned(path.resolve(root), match[2]));
      requireValue(pin.blob === match[1], "AUTHORITY_WORKING_SOURCE_CHANGED");
      authorityPins.push({ root: path.resolve(root), path: match[2], ...pin });
    }
  }
  requireValue(
    git(source.repairAuthorityRoot, ["rev-parse", "HEAD^{tree}"])
      .toString()
      .trim() === source.repairTree,
    "REPAIR_TREE_MISMATCH",
  );
  const registryBytes = git(source.originalAuthorityRoot, [
    "show",
    `${source.originalAuthoritySha}:${registryPath}`,
  ]);
  const record = JSON.parse(registryBytes).exceptions.find(
    (row) => row.id === plan.exception?.id,
  );
  requireValue(
    record &&
      digest(JSON.stringify(record)) === config.expected.recordDigest &&
      plan.exception.recordDigest === config.expected.recordDigest,
    "RECORD_MISMATCH",
  );
  for (const key of [
    "baseSha",
    "candidateSha",
    "sourceDigest",
    "contractDigest",
  ])
    requireValue(plan[key] === config.expected[key], `PLAN_${key}_MISMATCH`);
  requireValue(
    capture.baseSha === plan.baseSha &&
      capture.sourceDigest === plan.sourceDigest &&
      capture.contractDigest === plan.contractDigest,
    "CAPTURE_BINDING_MISMATCH",
  );
  assert.deepEqual(
    capture.exception,
    plan.exception,
    "ACTUAL_OUTPUT_DIAGNOSTIC_CAPTURE_EXCEPTION_CHANGED",
  );
  requireValue(
    capture.exceptionPreparationReservation ===
      config.expected.preparationReservation,
    "CAPTURE_ORIGINAL_RESERVATION_MISMATCH",
  );
  for (const key of [
    "baseSha",
    "candidateSha",
    "sourceDigest",
    "contractDigest",
  ])
    requireValue(
      originalJournal[key] === plan[key],
      "ORIGINAL_JOURNAL_SOURCE_TUPLE_MISMATCH",
    );
  requireValue(
    originalJournal.version === 1 &&
      originalJournal.recordDigest === config.expected.recordDigest &&
      originalJournal.canonicalDirectory === canonical,
    "ORIGINAL_JOURNAL_RECORD_MISMATCH",
  );
  const selected = closure(capture, workingDirectory, record);
  const exactScope = (values) => [...values].sort();
  requireValue(
    record.contractIds.length === 7 && new Set(record.contractIds).size === 7,
    "ORIGINAL_SEVEN_CONTRACT_SCOPE",
  );
  assert.deepEqual(
    exactScope(plan.contractIds),
    exactScope(record.contractIds),
  );
  assert.deepEqual(
    exactScope(plan.contracts.map((contract) => contract.id)),
    exactScope(record.contractIds),
  );
  assert.deepEqual(
    exactScope([
      ...new Set(capture.artifacts.map((artifact) => artifact.contractId)),
    ]),
    exactScope(record.contractIds),
  );
  const extras = [...sourceStage.keys()]
    .filter((file) => !selected.selected.includes(file))
    .sort();
  requireValue(
    selected.selected.every((file) => sourceStage.has(file)),
    "REQUIRED_STAGE_FILE_MISSING",
  );
  requireValue(
    extras.every((file) => file.endsWith(".webm")),
    "UNKNOWN_AUXILIARY_TYPE",
  );
  const expectedTuples = tuples(plan);
  requireValue(
    new Set(expectedTuples.map((row) => JSON.stringify(row))).size ===
      expectedTuples.length &&
      capture.journeys.length === expectedTuples.length,
    "GENERIC_CONTEXT_COUNT",
  );
  for (const tuple of expectedTuples)
    requireValue(
      capture.journeys.filter((row) =>
        Object.entries(tuple).every(([key, value]) => row[key] === value),
      ).length === 1,
      "GENERIC_CONTEXT_MISSING_OR_DUPLICATED",
    );
  requireValue(
    capture.journeys.every((row) => row.status === "PASS"),
    "ORIGINAL_JOURNEY_NOT_PASS",
  );
  const counts = {
    originalFiles: inputFiles.size,
    stageFiles: sourceStage.size,
    jsonFiles: selected.jsonPaths.length,
    uniqueMedia: selected.media.size,
    extras: extras.length,
    genericContexts: expectedTuples.length,
    pairedContexts: capture.pairedEvidence?.browserContexts,
  };
  for (const [key, expected] of Object.entries(config.expected.counts))
    requireValue(counts[key] === expected, `ACTUAL_COUNT_${key}`);
  const publicationSource = (root) =>
    readFile(
      path.join(
        root,
        "scripts/sounding-line/experience-capture-publication.mjs",
      ),
      "utf8",
    );
  const body = (text) =>
    text.slice(
      text.indexOf("export async function publishExperienceCapture("),
      text.indexOf("export async function createCaptureSubmission("),
    );
  const originalBody = body(
    await publicationSource(source.originalAuthorityRoot),
  );
  requireValue(
    originalBody ===
      body(await publicationSource(source.repairAuthorityRoot)) &&
      digest(originalBody) === config.expected.strictPublisherSHA256,
    "STRICT_PUBLISHER_CHANGED",
  );
  const modules = {};
  for (const [key, root] of [
    ["original", source.originalAuthorityRoot],
    ["repair", source.repairAuthorityRoot],
  ])
    modules[key] = await import(
      pathToFileURL(
        path.join(
          root,
          "scripts/sounding-line/experience-capture-publication.mjs",
        ),
      )
    );
  const raw = await import(
    pathToFileURL(
      path.join(
        source.repairAuthorityRoot,
        "scripts/sounding-line/experience-raw-output.mjs",
      ),
    )
  );
  const retention = await import(
    pathToFileURL(
      path.join(
        source.repairAuthorityRoot,
        "scripts/sounding-line/experience-raw-retention.mjs",
      ),
    )
  );
  const product = await import(
    pathToFileURL(
      path.join(
        source.repairAuthorityRoot,
        "scripts/sounding-line/product-experience.mjs",
      ),
    )
  );
  const paired = await import(
    pathToFileURL(
      path.join(
        source.repairAuthorityRoot,
        "scripts/sounding-line/experience-paired.mjs",
      ),
    )
  );
  globalThis.fetch = () => {
    throw Error("ACTUAL_OUTPUT_DIAGNOSTIC_NETWORK_FORBIDDEN");
  };
  for (const key of Object.keys(process.env))
    if (!(key in cleanEnv)) delete process.env[key];
  Object.assign(process.env, cleanEnv, {
    GIT_DIR: path.resolve(source.candidateGitDir),
    GIT_NO_LAZY_FETCH: "1",
    GIT_OPTIONAL_LOCKS: "0",
  });
  const candidate = (args) =>
    git(output, args, { GIT_DIR: process.env.GIT_DIR });
  const beforeGit = {
    head: candidate(["rev-parse", "HEAD"]).toString().trim(),
    tree: candidate(["rev-parse", "HEAD^{tree}"]).toString().trim(),
    stage0: digest(candidate(["ls-files", "--stage", "-z"])),
  };
  requireValue(
    beforeGit.head === plan.candidateSha &&
      beforeGit.tree === source.candidateTree,
    "CANDIDATE_GIT_IDENTITY",
  );
  const tracked = new Map(
    candidate(["ls-tree", "-r", "-z", plan.candidateSha, "--", canonical])
      .toString()
      .split("\0")
      .filter(Boolean)
      .map((row) => {
        const match = /^(\d+) blob ([a-f0-9]{40})\t(.+)$/u.exec(row);
        requireValue(match, "CANDIDATE_TREE_TYPE");
        return [match[3], { mode: match[1], blob: match[2] }];
      }),
  );
  const targetPaths = selected.selected.map(
    (file) => canonical + file.slice(workingDirectory.length),
  );
  const preimages = [];
  const template = await realpath(config.preimageProjectionRoot);
  requireValue(
    template === path.resolve(config.preimageProjectionRoot),
    "PREIMAGE_ROOT_SYMLINK",
  );
  for (const target of targetPaths) {
    const metadata = tracked.get(target);
    if (metadata) {
      requireValue(metadata.mode === "100644", "PREIMAGE_MODE");
      const pin = await fingerprint(await owned(template, target));
      requireValue(pin.blob === metadata.blob, "PREIMAGE_BLOB_MISMATCH");
      preimages.push({ path: target, ...pin });
    } else {
      try {
        await lstat(path.join(template, target));
        requireValue(false, "UNTRACKED_PREIMAGE_PRESENT");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
  const externalReview =
    "Development_Docs/Testing/Product_Experience/candidate-review.json";
  const externalBlob = candidate([
    "rev-parse",
    `${plan.candidateSha}:${externalReview}`,
  ])
    .toString()
    .trim();
  const externalPin = await fingerprint(await owned(template, externalReview));
  requireValue(externalPin.blob === externalBlob, "EXTERNAL_REVIEW_PREIMAGE");
  async function caseRoot(name) {
    const root = path.join(output, name);
    await mkdir(root);
    for (const file of [...preimages, { path: externalReview }])
      await copyExact(
        await owned(template, file.path),
        path.join(root, file.path),
      );
    return root;
  }
  async function stageInputs(root) {
    for (const [target, member] of sourceStage)
      await copyExact(
        await owned(extractionRoot, member),
        path.join(root, target),
      );
  }
  function useRoot(root) {
    process.env.GIT_WORK_TREE = root;
  }
  await write("input-and-closure.private.json", {
    qualification: false,
    acceptance: false,
    zipBefore,
    extractionManifest: {
      bytes: manifestBytes.length,
      sha256: digest(manifestBytes),
      trustedIntakeChecks: manifest.checks,
    },
    source: {
      ...source,
      strictPublisherSHA256: digest(originalBody),
      registrySHA256: digest(registryBytes),
      recordDigest: digest(JSON.stringify(record)),
    },
    counts,
    originalWorkingDirectory: workingDirectory,
    selected: selected.selected,
    extras,
    classifiedOriginalStage: [...sourceStage].map(([file, member]) => ({
      path: file,
      archiveMember: member,
      ...inputFiles.get(member),
      classification: selected.jsonPaths.includes(file)
        ? "DECLARED_JSON"
        : selected.media.has(file)
          ? "DECLARED_MEDIA"
          : "UNDECLARED_WEBM",
      artifactRows: selected.media.get(file) ?? [],
    })),
    originalNonStageMembers: [...inputFiles]
      .filter(([member]) => !stageFiles.includes(member))
      .map(([member, pin]) => ({ archiveMember: member, ...pin })),
    physicalMediaAliases: [...selected.media].map(([file, artifacts]) => ({
      path: file,
      artifactRows: artifacts,
      source: inputFiles.get(sourceStage.get(file)),
    })),
    genericTuples: expectedTuples,
    pairedBinding: capture.pairedEvidence?.binding,
    authorityPins,
    beforeGit,
    preimages,
    externalReview: externalPin,
    actualArchiveReplay: true,
    browserOrSubprocessReplay: false,
  });
  phase = "ORIGINAL_GUARD_REPRODUCTION";
  const originalRoot = await caseRoot("original-stage-control");
  await stageInputs(originalRoot);
  const originalStageBefore = await tree(originalRoot, workingDirectory),
    originalCanonicalBefore = await tree(originalRoot, "Development_Docs");
  useRoot(originalRoot);
  for (const key of ["original", "repair"]) {
    const journalDirectory = `artifacts/sounding-line/product-experience-capture-publication/capture-control-${key}`;
    let observed;
    try {
      await modules[key].publishExperienceCapture({
        root: originalRoot,
        plan,
        record,
        workingDirectory,
        journalDirectory,
      });
    } catch (error) {
      observed = error;
    }
    requireValue(
      observed?.message ===
        "PRODUCT_EXPERIENCE_CAPTURE_PUBLICATION_UNREFERENCED_OUTPUT",
      "ORIGINAL_GUARD_NOT_REPRODUCED",
    );
    const journal = await readJson(
      originalRoot,
      `${journalDirectory}/journal.json`,
    );
    requireValue(
      journal.status === "FAILED" &&
        journal.attempted.length === 0 &&
        journal.promoted.length === 0,
      "ORIGINAL_GUARD_MUTATED_CANONICAL",
    );
    assert.deepEqual(
      await tree(originalRoot, workingDirectory),
      originalStageBefore,
    );
    assert.deepEqual(
      await tree(originalRoot, "Development_Docs"),
      originalCanonicalBefore,
    );
    phases.push({
      phase,
      implementation: key,
      result: "EXPECTED_UNREFERENCED_OUTPUT",
      journalDirectory,
      journal: {
        path: relative(
          output,
          path.join(originalRoot, journalDirectory, "journal.json"),
        ),
        ...(await fingerprint(
          path.join(originalRoot, journalDirectory, "journal.json"),
        )),
      },
    });
  }
  phase = "ACTUAL_BYTE_COPY_BOUNDARY";
  const repairedRoot = await caseRoot("repaired-selected-boundary");
  useRoot(repairedRoot);
  const rawDirectory = `${path.posix.dirname(workingDirectory)}/raw`;
  await raw.createRawOutputDirectory({
    root: repairedRoot,
    directory: rawDirectory,
  });
  for (const [target, member] of sourceStage)
    await copyExact(
      await owned(extractionRoot, member),
      path.join(
        repairedRoot,
        rawDirectory,
        "original",
        target.slice(workingDirectory.length + 1),
      ),
    );
  const binding = raw.rawCaptureBinding(plan);
  for (const file of selected.selected) {
    const group = selected.media.get(file);
    await raw.copyDeclaredCaptureFile({
      root: repairedRoot,
      rawDirectory,
      source: `${rawDirectory}/original/${file.slice(workingDirectory.length + 1)}`,
      destination: file,
      kind: group ? group[0].type : "json",
      binding,
    });
  }
  requireValue(
    Object.keys(await tree(repairedRoot, workingDirectory)).length ===
      selected.selected.length,
    "CLOSED_STAGE_COUNT",
  );
  for (const file of selected.selected)
    assert.deepEqual(
      await fingerprint(path.join(repairedRoot, file)),
      inputFiles.get(sourceStage.get(file)),
    );
  const stagedCapture = await readJson(
    repairedRoot,
    `${workingDirectory}/capture.json`,
  );
  product.validateExperienceArtifacts({
    root: repairedRoot,
    plan,
    evidence: stagedCapture,
  });
  const syncRead = (await import("node:fs")).readFileSync;
  paired.validatePairedEvidence({
    root: repairedRoot,
    plan,
    evidence: stagedCapture,
    read: (file) => syncRead(path.join(repairedRoot, file)),
  });
  const rawInventory = await raw.sealRawCaptureOutput({
    root: repairedRoot,
    rawDirectory,
    binding,
    outcome: "PASS",
  });
  const encryptedDirectory = `${path.posix.dirname(workingDirectory)}/encrypted`;
  const completion = await retention.retainRawCaptureOutput({
    root: repairedRoot,
    rawDirectory,
    encryptedDirectory,
    binding,
    outcome: "PASS",
  });
  const verifiedPaths = await retention.verifiedRawCapturePaths(completion);
  const rawBefore = await tree(repairedRoot, rawDirectory),
    stageBefore = await tree(repairedRoot, workingDirectory),
    encryptedBefore = await tree(repairedRoot, encryptedDirectory),
    canonicalBefore = await tree(repairedRoot, "Development_Docs");
  await write("raw-boundary.private.json", {
    qualification: false,
    acceptance: false,
    rawInventory,
    rawFiles: rawBefore,
    selectedStageFiles: stageBefore,
    encryptedFiles: encryptedBefore,
    rawInventoryPin: {
      path: relative(
        output,
        path.join(repairedRoot, rawDirectory, "raw-output-inventory.json"),
      ),
      ...(await fingerprint(
        path.join(repairedRoot, rawDirectory, "raw-output-inventory.json"),
      )),
    },
    retentionPin: {
      path: relative(
        output,
        path.join(repairedRoot, encryptedDirectory, "retention.json"),
      ),
      ...(await fingerprint(
        path.join(repairedRoot, encryptedDirectory, "retention.json"),
      )),
    },
    verifiedEncryptedPaths: verifiedPaths,
  });
  requireValue(
    rawInventory.files.filter((file) => file.classification === "RAW_ONLY")
      .length === extras.length,
    "RAW_EXTRA_CONSERVATION",
  );
  phases.push({
    phase,
    result: "PASS",
    selectedFiles: selected.selected.length,
    undeclaredOriginalsRetained: extras.length,
    verifiedEncryptedPaths: verifiedPaths,
  });
  const preimagesByPath = new Map(preimages.map((file) => [file.path, file]));
  const failTarget = targetPaths
    .filter(
      (file) =>
        !file.endsWith(".json") &&
        tracked.has(file) &&
        preimagesByPath.get(file).sha256 !==
          selected.media.get(workingDirectory + file.slice(canonical.length))[0]
            .sha256,
    )
    .sort()[0];
  requireValue(failTarget, "TRACKED_MEDIA_ROLLBACK_TARGET_REQUIRED");
  for (const mode of ["before", "after"]) {
    phase = `ACTUAL_PROMOTION_ROLLBACK_${mode.toUpperCase()}`;
    const sentinel = new Error(
      `ACTUAL_OUTPUT_INJECTED_${mode.toUpperCase()}_RENAME`,
    );
    const journalDirectory = `artifacts/sounding-line/product-experience-capture-publication/capture-actual-${mode}`;
    let observed;
    try {
      await modules.repair.publishExperienceCapture({
        root: repairedRoot,
        plan,
        record,
        workingDirectory,
        journalDirectory,
        promote: async (from, to) => {
          if (to === path.join(repairedRoot, failTarget) && mode === "before")
            throw sentinel;
          await rename(from, to);
          if (to === path.join(repairedRoot, failTarget) && mode === "after")
            throw sentinel;
        },
      });
    } catch (error) {
      observed = error;
    }
    requireValue(observed === sentinel, "ROLLBACK_ORIGINAL_ERROR_LOST");
    const journal = await readJson(
      repairedRoot,
      `${journalDirectory}/journal.json`,
    );
    requireValue(
      journal.status === "FAILED" &&
        journal.attempted.includes(failTarget) &&
        journal.rollback.every((entry) =>
          ["RESTORED", "UNCHANGED"].includes(entry.status),
        ),
      "ROLLBACK_INCOMPLETE",
    );
    requireValue(
      journal.rollback.find((entry) => entry.path === failTarget)?.status ===
        (mode === "after" ? "RESTORED" : "UNCHANGED"),
      "TARGET_RENAME_ROLLBACK_NOT_PROVEN",
    );
    assert.deepEqual(
      await tree(repairedRoot, "Development_Docs"),
      canonicalBefore,
    );
    assert.deepEqual(await tree(repairedRoot, rawDirectory), rawBefore);
    assert.deepEqual(await tree(repairedRoot, workingDirectory), stageBefore);
    assert.deepEqual(
      await tree(repairedRoot, encryptedDirectory),
      encryptedBefore,
    );
    phases.push({
      phase,
      result: "EXPECTED_FAILURE_ROLLED_BACK",
      target: failTarget,
      journalDirectory,
      journal: {
        path: relative(
          output,
          path.join(repairedRoot, journalDirectory, "journal.json"),
        ),
        ...(await fingerprint(
          path.join(repairedRoot, journalDirectory, "journal.json"),
        )),
      },
    });
  }
  phase = "ACTUAL_CLOSED_PUBLICATION_SUCCESS";
  const result = await modules.repair.publishExperienceCapture({
    root: repairedRoot,
    plan,
    record,
    workingDirectory,
    journalDirectory:
      "artifacts/sounding-line/product-experience-capture-publication/capture-actual-success",
  });
  const finalCapture = JSON.parse(await readFile(result.capturePath));
  product.validateExperienceArtifacts({
    root: repairedRoot,
    plan,
    evidence: finalCapture,
  });
  paired.validatePairedEvidence({
    root: repairedRoot,
    plan,
    evidence: finalCapture,
    read: (file) => syncRead(path.join(repairedRoot, file)),
  });
  const current = await import(
    pathToFileURL(
      path.join(
        source.repairAuthorityRoot,
        "scripts/sounding-line/experience-current-admission.mjs",
      ),
    )
  );
  current.validateCurrentPublicationArtifacts(finalCapture.artifacts);
  const stable = (evidence) =>
    evidence.artifacts.map(({ path: file, ...rest }) => rest);
  assert.deepEqual(stable(finalCapture), stable(capture));
  assert.deepEqual(finalCapture.journeys, capture.journeys);
  for (const [file, group] of selected.media)
    requireValue(
      (
        await fingerprint(
          path.join(
            repairedRoot,
            canonical + file.slice(workingDirectory.length),
          ),
        )
      ).sha256 === group[0].sha256,
      "FINAL_MEDIA_CHANGED",
    );
  for (const file of selected.jsonPaths.filter((file) =>
    file.includes("/paired/"),
  ))
    assert.deepEqual(
      await fingerprint(
        path.join(
          repairedRoot,
          canonical + file.slice(workingDirectory.length),
        ),
      ),
      inputFiles.get(sourceStage.get(file)),
    );
  assert.deepEqual(
    await fingerprint(path.join(repairedRoot, externalReview)),
    externalPin,
  );
  assert.deepEqual(await tree(repairedRoot, rawDirectory), rawBefore);
  assert.deepEqual(await tree(repairedRoot, workingDirectory), stageBefore);
  assert.deepEqual(
    await tree(repairedRoot, encryptedDirectory),
    encryptedBefore,
  );
  assert.deepEqual(await tree(extractionRoot), actualExtraction);
  assert.deepEqual(await fingerprint(config.originalZip.path), zipBefore);
  requireValue(
    digest(await readFile(config.extraction.manifestPath)) ===
      config.extraction.manifestSHA256,
    "FINAL_MANIFEST_CHANGED",
  );
  for (const file of authorityPins)
    assert.deepEqual(await fingerprint(path.join(file.root, file.path)), {
      bytes: file.bytes,
      sha256: file.sha256,
      blob: file.blob,
      permissions: file.permissions,
    });
  for (const [root, sha] of [
    [source.originalAuthorityRoot, source.originalAuthoritySha],
    [source.repairAuthorityRoot, source.repairSha],
  ])
    requireValue(
      git(root, ["rev-parse", "HEAD"]).toString().trim() === sha,
      "FINAL_AUTHORITY_HEAD_CHANGED",
    );
  const afterGit = {
    head: candidate(["rev-parse", "HEAD"]).toString().trim(),
    tree: candidate(["rev-parse", "HEAD^{tree}"]).toString().trim(),
    stage0: digest(candidate(["ls-files", "--stage", "-z"])),
  };
  assert.deepEqual(afterGit, beforeGit);
  phases.push({
    phase,
    result: "PASS",
    journalPath: result.journalPath,
    journal: {
      path: relative(output, result.journalPath),
      ...(await fingerprint(result.journalPath)),
    },
    sourceAndOriginalPreserved: true,
  });
  await write("actual-publication-proof.private.json", {
    status: "PASS",
    classification: "ACTUAL_BYTES_PUBLICATION_DIAGNOSTIC_ONLY",
    qualification: false,
    acceptance: false,
    productReview: false,
    newCaptureOrBrowserExecution: false,
    custodyOrAuthorityInvocation: false,
    actualArchiveBytesReplayed: true,
    subprocessProducerReplay: false,
    originalDatabaseURLInvented: false,
    originalWitnessOrStageJSONRewritten: false,
    counts,
    phases,
    inputClosureReceipt: {
      path: "input-and-closure.private.json",
      ...(await fingerprint(
        path.join(output, "input-and-closure.private.json"),
      )),
    },
    rawBoundaryReceipt: {
      path: "raw-boundary.private.json",
      ...(await fingerprint(path.join(output, "raw-boundary.private.json"))),
    },
    beforeGit,
    afterGit,
    sourceConservation: true,
    rawConservation: true,
    byteExactMedia: true,
  });
  finalStatus = "PASS";
} catch (error) {
  await write("failure.private.json", {
    status: "FAIL",
    qualification: false,
    acceptance: false,
    phase,
    error: { name: error.name, message: error.message, stack: error.stack },
    completedPhases: phases,
    originalAndPartialOutputsRetained: true,
  });
  process.exitCode = 1;
} finally {
  await write("terminal.private.json", {
    status: finalStatus,
    qualification: false,
    acceptance: false,
    phase,
    phases,
    noProductBrowserOrCapture: true,
  });
  process.stdout.write(`ACTUAL_OUTPUT_DIAGNOSTIC_${finalStatus}\n`);
}
