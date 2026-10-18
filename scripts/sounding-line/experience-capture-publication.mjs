import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, readFileSync } from "node:fs";
import {
  constants,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { runTrustedExperienceReplay, writeExperienceReviewPackets } from "./experience-browser.mjs";
import { experienceDigest, validateExperienceArtifacts } from "./product-experience.mjs";
import { validatePairedEvidence } from "./experience-paired.mjs";
import { validateCurrentPublicationArtifacts } from "./experience-current-admission.mjs";
import { createBrowserDiagnosticSession } from "./browser-diagnostics.mjs";

const canonical = "Development_Docs/Testing/Product_Experience/evidence";
const staging = "artifacts/sounding-line/product-experience-capture-staging";
const publication = "artifacts/sounding-line/product-experience-capture-publication";
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_CAPTURE_PUBLICATION_${code}`);
};
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const relative = (root, file) => path.relative(root, file).split(path.sep).join("/");
const inside = (file, directory) => file.startsWith(directory + "/");
function validPath(file) {
  if (
    typeof file !== "string" ||
    !file ||
    /[\\\u0000-\u001f\u007f]/u.test(file) ||
    path.posix.isAbsolute(file) ||
    file.split("/").some((p) => !p || p === "." || p === "..")
  )
    fail("PATH_INVALID");
  return file;
}
async function statOrNull(file) {
  try {
    return await lstat(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
// Every existing component must be a real directory; realpath containment alone
// would permit a source/output symlink to redirect otherwise canonical writes.
async function ownedPath(root, file, { directories = false } = {}) {
  validPath(file);
  const parts = file.split("/");
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let stat = await statOrNull(current);
    if (!stat && directories && i < parts.length - 1) {
      await mkdir(current);
      stat = await lstat(current);
    }
    if (
      stat &&
      (stat.isSymbolicLink() ||
        (i < parts.length - 1 && !stat.isDirectory()) ||
        (i === parts.length - 1 && !stat.isFile() && !stat.isDirectory()))
    )
      fail("PATH_NOT_OWNED");
  }
  return current;
}
async function directory(root, file) {
  const target = await ownedPath(root, file + "/.directory", { directories: true });
  return path.dirname(target);
}
async function fingerprint(file) {
  const before = await lstat(file);
  if (!before.isFile() || before.isSymbolicLink() || (before.mode & 0o7111) !== 0) fail("REGULAR_FILE_REQUIRED");
  const sha1 = createHash("sha1").update(`blob ${before.size}\0`),
    sha256 = createHash("sha256");
  for await (const chunk of createReadStream(file, { highWaterMark: 1024 * 1024 })) {
    sha1.update(chunk);
    sha256.update(chunk);
  }
  const after = await lstat(file);
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeNs !== after.mtimeNs ||
    before.mtimeMs !== after.mtimeMs ||
    before.ctimeMs !== after.ctimeMs
  )
    fail("FILE_CHANGED");
  return {
    bytes: before.size,
    mode: "100644",
    permissions: before.mode & 0o777,
    blob: sha1.digest("hex"),
    sha256: sha256.digest("hex"),
  };
}
async function files(root, directoryPath) {
  const result = [];
  async function visit(dir) {
    for (const item of (await readdir(await ownedPath(root, dir), { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const file = `${dir}/${item.name}`;
      await ownedPath(root, file);
      if (item.isDirectory()) await visit(file);
      else if (item.isFile()) result.push(file);
      else fail("REGULAR_FILE_REQUIRED");
      if (result.length > 4096) fail("FILE_LIMIT");
    }
  }
  await visit(directoryPath);
  return result;
}
function mapCapture(evidence, from) {
  const mapped = structuredClone(evidence);
  const map = (file) => {
    validPath(file);
    if (!inside(file, from)) fail("SOURCE_PATH_ESCAPE");
    return canonical + file.slice(from.length);
  };
  for (const artifact of mapped.artifacts) artifact.path = map(artifact.path);
  if (mapped.pairedEvidence) {
    for (const reference of [
      mapped.pairedEvidence.report,
      mapped.pairedEvidence.runtime,
      mapped.pairedEvidence.profile,
      ...mapped.pairedEvidence.cases.map((item) => item.witness),
    ]) {
      if (!reference) fail("PAIRED_REFERENCE_MISSING");
      reference.path = map(reference.path);
    }
  }
  return mapped;
}

export async function publishExperienceCapture({
  root,
  plan,
  record,
  workingDirectory,
  journalDirectory,
  promote = rename,
  writeJournal = writeFile,
  preparedJournal = false,
}) {
  root = path.resolve(root);
  if ((await realpath(root)) !== root) fail("ROOT_SYMLINK");
  validPath(workingDirectory);
  validPath(journalDirectory);
  if (!inside(workingDirectory, staging) || !inside(journalDirectory, publication)) fail("OUTPUT_NOT_OWNED");
  const git = (args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
      maxBuffer: 64 * 1024 * 1024,
    });
  assert.equal(
    git(["rev-parse", "HEAD"]).trim(),
    plan.candidateSha,
    "PRODUCT_EXPERIENCE_CAPTURE_PUBLICATION_SOURCE_CHANGED",
  );
  const tracked = new Map(
    git(["ls-tree", "-r", "-z", plan.candidateSha, "--", canonical])
      .split("\0")
      .filter(Boolean)
      .map((line) => {
        const match = /^(\d+) blob ([a-f0-9]{40})\t(.+)$/u.exec(line);
        if (!match) fail("SOURCE_TREE_INVALID");
        return [match[3], { mode: match[1], blob: match[2] }];
      }),
  );
  const journalRoot = await ownedPath(root, journalDirectory, { directories: true });
  if (preparedJournal) {
    // The protected capture caller claimed this empty directory before replay.
    if (!(await lstat(journalRoot)).isDirectory() || (await readdir(journalRoot)).length) fail("JOURNAL_NOT_EMPTY");
  } else await mkdir(journalRoot); // Never reuse a previous/partial publication.
  const journal = {
    version: 1,
    status: "PREPARING",
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    recordDigest: plan.exception?.recordDigest ?? null,
    workingDirectory,
    canonicalDirectory: canonical,
    files: [],
    attempted: [],
    promoted: [],
    rollback: [],
  };
  const journalPath = path.join(journalRoot, "journal.json");
  let journalSequence = 0;
  const save = async () => {
    // A failed/full-disk write leaves the last complete journal intact, alongside
    // its create-only partial successor; neither may masquerade as a final PASS.
    const pending = path.join(journalRoot, `journal.${++journalSequence}.pending`);
    await writeJournal(pending, json(journal), { flag: "wx" });
    await rename(pending, journalPath);
  };
  await save();
  try {
    const sourceFiles = await files(root, workingDirectory);
    const capture = mapCapture(
      JSON.parse(await readFile(await ownedPath(root, `${workingDirectory}/capture.json`), "utf8")),
      workingDirectory,
    );
    if (
      capture.sourceDigest !== plan.sourceDigest ||
      capture.contractDigest !== plan.contractDigest ||
      capture.baseSha !== plan.baseSha
    )
      fail("CAPTURE_IDENTITY_CHANGED");
    const media = new Set(capture.artifacts.map((artifact) => artifact.path));
    const jsonFiles = sourceFiles
      .filter((file) => file.endsWith(".json"))
      .map((file) => canonical + file.slice(workingDirectory.length));
    const expectedJson = record?.currentSourceAdmission?.publicationFiles?.filter((file) => inside(file, canonical));
    if (
      expectedJson &&
      (new Set(expectedJson).size !== expectedJson.length ||
        jsonFiles.length !== expectedJson.length ||
        jsonFiles.some((file) => !expectedJson.includes(file)))
    )
      fail("JSON_CLOSURE_CHANGED");
    const targets = [...new Set([...jsonFiles, ...media])].sort();
    if (
      sourceFiles.length !== targets.length ||
      sourceFiles.some((file) => !targets.includes(canonical + file.slice(workingDirectory.length)))
    )
      fail("UNREFERENCED_OUTPUT");
    for (const file of targets) {
      validPath(file);
      if (
        !inside(file, canonical) ||
        (record?.immutableHistory ?? []).some(
          (entry) => file === entry.path || inside(file, entry.path) || inside(entry.path, file),
        )
      )
        fail("IMMUTABLE_HISTORY_OVERLAP");
      if (!file.endsWith(".json") && !media.has(file)) fail("PUBLICATION_PATH_INVALID");
    }
    const ready = `${journalDirectory}/ready`;
    await directory(root, ready);
    for (const file of sourceFiles) {
      const suffix = file.slice(workingDirectory.length + 1);
      const output = await ownedPath(root, `${ready}/${suffix}`, { directories: true });
      await copyFile(await ownedPath(root, file), output, constants.COPYFILE_EXCL);
      await fingerprint(output);
    }
    const manifests = sourceFiles.filter((file) => file.endsWith("/capture.json"));
    for (const file of manifests) {
      const suffix = file.slice(workingDirectory.length + 1);
      const evidence = mapCapture(JSON.parse(await readFile(path.join(root, file), "utf8")), workingDirectory);
      const artifactRoot = path.dirname(path.join(root, ready, suffix));
      await writeFile(path.join(artifactRoot, "capture.json"), json(evidence));
      const contracts =
        file === `${workingDirectory}/capture.json`
          ? plan.contracts
          : plan.contracts.filter(
              (contract) =>
                (contract.experience.fixtureProfile ?? "generic") === path.posix.basename(path.posix.dirname(file)),
            );
      await writeExperienceReviewPackets({ plan: { ...plan, contracts }, evidence, artifactRoot });
    }
    const read = (file) => {
      validPath(file);
      if (!inside(file, canonical)) fail("OUTPUT_PATH_ESCAPE");
      // All ready-tree entries were checked without following symlinks above.
      return readFileSync(path.join(root, ready, file.slice(canonical.length + 1)));
    };
    validateExperienceArtifacts({ root, plan, evidence: capture, readArtifact: ({ file }) => read(file) });
    validatePairedEvidence({ root, plan, evidence: capture, read });
    if (record?.currentSourceAdmission) validateCurrentPublicationArtifacts(capture.artifacts);
    for (const file of targets) {
      const destination = await ownedPath(root, file);
      const existing = await statOrNull(destination);
      if (Boolean(tracked.get(file)) !== Boolean(existing)) fail("DESTINATION_SOURCE_PRESENCE_CHANGED");
      const previous = existing ? await fingerprint(destination) : null;
      if (previous && (tracked.get(file)?.mode !== previous.mode || tracked.get(file)?.blob !== previous.blob))
        fail("DESTINATION_NOT_CLEAN_TRACKED_SOURCE");
      if (previous) {
        git(["cat-file", "-e", previous.blob]);
        const backup = await ownedPath(root, `${journalDirectory}/preimages/${file}`, { directories: true });
        await copyFile(destination, backup, constants.COPYFILE_EXCL);
        assert.deepEqual(await fingerprint(backup), previous);
      }
      journal.files.push({
        path: file,
        previous,
        source: await fingerprint(path.join(root, workingDirectory, file.slice(canonical.length + 1))),
        next: await fingerprint(path.join(root, ready, file.slice(canonical.length + 1))),
      });
    }
    journal.status = "READY";
    await save();
    for (const item of journal.files) {
      const destination = await ownedPath(root, item.path, { directories: true });
      assert.deepEqual(
        (await statOrNull(destination)) ? await fingerprint(destination) : null,
        item.previous,
        "PRODUCT_EXPERIENCE_CAPTURE_PUBLICATION_DESTINATION_CHANGED",
      );
      journal.attempted.push(item.path);
      await save();
      await promote(path.join(root, ready, item.path.slice(canonical.length + 1)), destination);
      journal.promoted.push(item.path);
      await save();
      assert.deepEqual(await fingerprint(destination), item.next);
    }
    journal.status = "PASS";
    await save();
    return { capturePath: path.join(root, canonical, "capture.json"), journalPath };
  } catch (error) {
    journal.status = "FAILED";
    journal.error = String(error);
    const failures = [];
    for (const file of [...journal.attempted].reverse()) {
      const item = journal.files.find((entry) => entry.path === file);
      try {
        const destination = await ownedPath(root, file);
        const current = (await statOrNull(destination)) ? await fingerprint(destination) : null;
        if (JSON.stringify(current) === JSON.stringify(item.previous)) {
          journal.rollback.push({ path: file, status: "UNCHANGED" });
          continue;
        }
        assert.deepEqual(current, item.next);
        if (item.previous) {
          const restored = `${journalDirectory}/restore/${file}`;
          const temporary = await ownedPath(root, restored, { directories: true });
          await copyFile(path.join(journalRoot, "preimages", file), temporary, constants.COPYFILE_EXCL);
          await rename(temporary, destination);
          assert.deepEqual(await fingerprint(destination), item.previous);
        } else await unlink(destination);
        journal.rollback.push({ path: file, status: "RESTORED" });
      } catch (rollbackError) {
        journal.rollback.push({ path: file, status: "FAILED", error: String(rollbackError) });
        failures.push(rollbackError);
      }
    }
    const rollbackFailed = failures.length > 0;
    try {
      await save();
    } catch (journalError) {
      failures.push(journalError);
      try {
        await writeFile(
          path.join(journalRoot, "journal-failure.json"),
          json({ ...journal, journalError: String(journalError) }),
          { flag: "wx" },
        );
      } catch (failureReceiptError) {
        failures.push(failureReceiptError);
      }
    }
    if (failures.length)
      throw new AggregateError(
        [error, ...failures],
        `PRODUCT_EXPERIENCE_CAPTURE_PUBLICATION_${rollbackFailed ? "ROLLBACK_INCOMPLETE" : "JOURNAL_FAILURE"}`,
        { cause: error },
      );
    throw error;
  }
}

export async function createCaptureSubmission({ root, plan, onPaths = async () => {} }) {
  root = path.resolve(root);
  if ((await realpath(root)) !== root) fail("ROOT_SYMLINK");
  const submission = "artifacts/sounding-line/product-experience-submission";
  const receiptRoot = await ownedPath(root, submission, { directories: true });
  await mkdir(receiptRoot); // Fixed loader member names, exclusively this invocation.
  await writeFile(path.join(receiptRoot, "plan.json"), json(plan), { flag: "wx" });
  await onPaths({
    capture_plan_path: `${submission}/plan.json`,
    capture_manifest_path: `${submission}/capture.json`,
    capture_activation_path: `${submission}/activation.json`,
  });
  return { receiptRoot };
}

export async function captureAndPublishExperience({
  root,
  plan,
  record,
  environment,
  replay = runTrustedExperienceReplay,
  promote = rename,
  onPaths = async () => {},
}) {
  root = path.resolve(root);
  if ((await realpath(root)) !== root) fail("ROOT_SYMLINK");
  const stageRoot = await directory(root, staging);
  const owned = await mkdtemp(path.join(stageRoot, "capture-"));
  const workingDirectory = `${relative(root, owned)}/capture`;
  const journalDirectory = `${publication}/${path.basename(owned)}`;
  await mkdir(await ownedPath(root, journalDirectory, { directories: true }));
  await mkdir(path.join(root, workingDirectory));
  await onPaths({
    capture_stage_path: workingDirectory,
    capture_journal_path: `${journalDirectory}/journal.json`,
    capture_journal_failure_path: `${journalDirectory}/journal-failure.json`,
    capture_journal_pending_path: `${journalDirectory}/journal.*.pending`,
  });
  const replayPlan = { ...plan, outputDirectory: workingDirectory };
  const diagnostics = createBrowserDiagnosticSession(root, {
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    planDigest: experienceDigest(replayPlan),
  });
  const runtimePaths = [],
    profilePaths = [];
  const result = await replay({
    root,
    plan: replayPlan,
    environment,
    validateReplay: false,
    diagnostics,
    onDiagnosticScope: async (paths) => {
      const scope = relative(root, paths.directory);
      if (!inside(scope, "artifacts/sounding-line/browser-diagnostics")) fail("DIAGNOSTIC_PATH_INVALID");
      await mkdir(await ownedPath(root, scope, { directories: true }));
      runtimePaths.push(relative(root, paths.runtime));
      profilePaths.push(relative(root, paths.profile));
      await onPaths({ capture_runtime_paths: [...runtimePaths], capture_profile_paths: [...profilePaths] });
    },
  });
  if (
    result.status !== "PASS" ||
    path.resolve(result.capturePath) !== path.join(root, workingDirectory, "capture.json")
  )
    fail("REPLAY_INCOMPLETE");
  const published = await publishExperienceCapture({
    root,
    plan,
    record,
    workingDirectory,
    journalDirectory,
    preparedJournal: true,
    promote,
  });
  return { ...result, ...published };
}
