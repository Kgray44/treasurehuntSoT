// Runs inside the existing OS-owned process boundary, without credentials or
// network. Only a complete installed-source and real negative-route proof passes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  custodyShadowPreload,
  readCustodyPilotSource,
  retainCustodyProofFrame,
} from "./noncampaign-custody-proof-files.mjs";
import { parseCustodyShadowTree, proposeNoncampaignCustodyShadow } from "./noncampaign-custody-shadow.mjs";
import {
  NONCAMPAIGN_CUSTODY_CERTIFICATE_REVISION,
  CERTIFIED_CUSTODY_PROFILE,
  custodyCertificatePaths,
  normalizeCustodyCertificateSource,
  custodySwitchAlternate,
  verifyCustodySwitchReader,
} from "./noncampaign-custody-read-set.mjs";
import { ordinaryCheckoutProfile } from "./ordinary-checkout.mjs";
import { EXPERIENCE_READER_REVISIONS, EXPERIENCE_READER_OBJECTS } from "./experience-checkout-roots.mjs";

const installed = fileURLToPath(new URL("../../", import.meta.url));
const hash = (b) => createHash("sha256").update(b).digest("hex");
const gitBlob = (b) => createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex");
const need = (ok, code) => {
  if (!ok) throw Error(`SOUNDING_LINE_CUSTODY_PROOF_${code}`);
};
const oid = (value) => typeof value === "string" && value.length === 40 && /^[a-f0-9]{40}$/u.test(value);
const nativeMetadataSha256 = Object.freeze({
  "55080155a1604f9c1ca0d2d62cb278055d77a1ef": "42ffffc2c14dab3e22ab2990e6f70e092afb119b33b5fe071d7b300aeda049b4",
  "089308bf475a2b22bfdc64ac46164996855e7010": "404670ce9f99e960b8805571dd4f463f4ca3ab6c61162b5d51e33d361d8e67d7",
});

export function custodyProofFilesystem(root, excluded = new Set()) {
  const pending = [root],
    entries = [];
  let bytes = 0;
  while (pending.length) {
    const parent = pending.pop();
    for (const name of fs.readdirSync(parent)) {
      const filename = path.join(parent, name);
      if (excluded.has(filename)) continue;
      const stat = fs.lstatSync(filename),
        relative = path.relative(root, filename);
      need(
        entries.length < 32768 && !stat.isSymbolicLink() && fs.realpathSync.native(filename) === filename,
        "FILESYSTEM_ALIAS_OR_BOUND",
      );
      if (stat.isDirectory()) {
        entries.push({ path: relative, type: "directory", mode: stat.mode & 0o777 });
        pending.push(filename);
      } else {
        const body = readCustodyPilotSource(filename);
        bytes += body.length;
        need(bytes <= 64 * 1024 ** 2, "FILESYSTEM_BYTES");
        entries.push({ path: relative, type: "file", mode: stat.mode & 0o777, bytes: body.length, sha256: hash(body) });
      }
    }
  }
  return hash(
    Buffer.from(JSON.stringify(entries.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path))))),
  );
}

export function runInstalledNegativeCustodyProof(input) {
  const { root, git, baseSha, candidateSha, prNumber, roots } = input;
  need(
    path.isAbsolute(root) &&
      path.isAbsolute(git) &&
      fs.realpathSync.native(root) === root &&
      oid(baseSha) &&
      oid(candidateSha) &&
      oid(NONCAMPAIGN_CUSTODY_CERTIFICATE_REVISION),
    "INPUT",
  );
  need(Number.isSafeInteger(prNumber) && prNumber > 0 && ![721, 776, 805, 820].includes(prNumber), "OWNER");
  need(Array.isArray(roots) && roots.length <= 32 && roots.every(oid), "ROOTS");
  need(
    process.env.GIT_NO_LAZY_FETCH === "1" &&
      process.env.GIT_CONFIG_VALUE_0 === "never" &&
      !Object.keys(process.env).some((key) => /TOKEN|SECRET|PASSWORD|^GITHUB_|^ACTIONS_|^GH_/iu.test(key)),
    "SANDBOX",
  );
  const directory = path.join(root, ".git/noncampaign-custody-proof"),
    frames = [],
    commands = [];
  need(fs.realpathSync.native(directory) === directory, "DIRECTORY_ALIAS");
  let ordinal = 0,
    retainedBytes = 0;
  const retain = (label, bytes) => {
    retainedBytes += bytes.length;
    need(retainedBytes <= 32 * 1024 ** 2, "ORIGINAL_BOUND");
    const name = `${String(++ordinal).padStart(4, "0")}-${label}.original.bin`;
    const value = { ordinal, path: name, ...retainCustodyProofFrame(path.join(directory, name), bytes) };
    frames.push(value);
    return value;
  };
  const record = (name, value) =>
    retainCustodyProofFrame(path.join(directory, name), Buffer.from(JSON.stringify(value) + "\n"));
  const run = (cwd, args, inputBytes) => {
    const result = spawnSync(
      git,
      ["-c", "core.fsmonitor=false", "-c", "gc.auto=0", "-c", "maintenance.auto=false", ...args],
      {
        cwd,
        env: process.env,
        input: inputBytes,
        encoding: null,
        maxBuffer: 16 * 1024 ** 2,
        timeout: 15000,
        windowsHide: true,
        stdio: [inputBytes === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      },
    );
    const original =
      result.error ??
      (result.status !== 0 || result.signal
        ? Object.assign(Error("CUSTODY_GIT_FAILED"), { status: result.status, signal: result.signal })
        : null);
    const errors = [],
      retained = {};
    for (const [label, bytes] of [
      ["stdout", result.stdout ?? Buffer.alloc(0)],
      ["stderr", result.stderr ?? Buffer.alloc(0)],
    ])
      try {
        retained[label] = retain(label, bytes);
      } catch (error) {
        errors.push(error);
      }
    commands.push({
      executable: path.basename(git),
      cwd,
      args,
      inputBytes: inputBytes?.length ?? 0,
      inputSha256: inputBytes ? hash(inputBytes) : null,
      exitCode: result.status,
      signal: result.signal,
      frames: retained,
      originalErrorPresent: !!original,
    });
    if (original || errors.length)
      throw new AggregateError([...(original ? [original] : []), ...errors], "CUSTODY_GIT_AND_RETENTION_FAILED", {
        cause: original ?? errors[0],
      });
    return result.stdout;
  };
  const gitAt = (args, bytes) => run(root, args, bytes);
  try {
    need(run(installed, ["rev-parse", "HEAD"]).toString().trim() === baseSha, "INSTALLED_BASE");
    gitAt(["merge-base", "--is-ancestor", NONCAMPAIGN_CUSTODY_CERTIFICATE_REVISION, baseSha]);
    gitAt(["merge-base", "--is-ancestor", baseSha, candidateSha]);
    need(
      gitAt(["rev-parse", "--is-shallow-repository"]).toString().trim() === "false" &&
        !fs.existsSync(path.join(root, ".git/objects/info/alternates")),
      "HISTORY_STORE",
    );
    const tree = (revision) => parseCustodyShadowTree(gitAt(["ls-tree", "-rz", revision]));
    const baseEntries = tree(baseSha),
      candidateEntries = tree(candidateSha),
      reviewedEntries = tree(NONCAMPAIGN_CUSTODY_CERTIFICATE_REVISION);
    const shadow = proposeNoncampaignCustodyShadow({
      baseSha,
      candidateSha,
      baseEntries,
      candidateEntries,
      purpose: "campaign-custody",
      prNumber,
    });
    need(shadow.profile === "NONCAMPAIGN_CUSTODY_METADATA_SHADOW_V1", "PROPOSAL_REQUIRES_FULL");
    const maps = [baseEntries, candidateEntries, reviewedEntries].map(
        (rows) => new Map(rows.map((row) => [row.path, row])),
      ),
      [base, candidate, reviewed] = maps;
    const identity = (row) => row && `${row.mode} ${row.type} ${row.blob}`;
    const attributes = (entries) =>
      entries
        .filter((row) => row.path === ".gitattributes" || row.path.endsWith("/.gitattributes"))
        .map((row) => `${row.path}\0${identity(row)}`)
        .sort();
    need(
      JSON.stringify(attributes(baseEntries)) === JSON.stringify(attributes(reviewedEntries)) &&
        JSON.stringify(attributes(candidateEntries)) === JSON.stringify(attributes(reviewedEntries)),
      "REVIEWED_ATTRIBUTES_CHANGED",
    );
    const certificateReaders = [];
    const installedRows = custodyCertificatePaths.map((filename) => {
      const actual = readCustodyPilotSource(path.join(installed, filename)),
        currentBlob = gitBlob(actual),
        normalizedBlob = gitBlob(normalizeCustodyCertificateSource(filename, actual));
      need(
        base.get(filename)?.mode === "100644" &&
          base.get(filename)?.blob === currentBlob &&
          candidate.get(filename)?.mode === "100644" &&
          reviewed.get(filename)?.mode === "100644" &&
          reviewed.get(filename)?.blob === normalizedBlob,
        "REVIEWED_INSTALLED_SOURCE_CHANGED",
      );
      if (candidate.get(filename).blob !== currentBlob) {
        need(filename === "scripts/sounding-line/ordinary-checkout.mjs", "CANDIDATE_TRANSPORT_CHANGED");
        const expected = custodySwitchAlternate(actual),
          expectedBlob = gitBlob(expected);
        need(candidate.get(filename).blob === expectedBlob, "CANDIDATE_SWITCH_CHANGED_OTHER_BYTES");
        const observed = gitAt(["cat-file", "blob", expectedBlob]);
        certificateReaders.push(
          verifyCustodySwitchReader({
            installedBytes: actual,
            candidateBytes: observed,
            mode: candidate.get(filename).mode,
            blob: expectedBlob,
            revision: candidateSha,
          }),
        );
      }
      return {
        path: filename,
        blob: currentBlob,
        reviewedBlob: normalizedBlob,
        bytes: actual.length,
        sha256: hash(actual),
      };
    });
    const policy = JSON.parse(
      readCustodyPilotSource(path.join(installed, "testing/noncampaign-custody-shadow-readers.json")),
    );
    for (const pin of policy.readers)
      need(installedRows.find((row) => row.path === pin.path)?.sha256 === pin.sha256, "NATIVE_PIN_CHANGED");
    for (const pin of policy.metadata) {
      const bytes = gitAt(["cat-file", "blob", pin.blob]);
      need(
        hash(bytes) === nativeMetadataSha256[pin.blob] && gitBlob(bytes) === pin.blob,
        "NATIVE_METADATA_BYTES_CHANGED",
      );
    }
    const eventObject = {
      pull_request: {
        number: prNumber,
        base: { sha: baseSha, repo: { full_name: "Kgray44/treasurehuntSoT" } },
        head: { sha: candidateSha, repo: { full_name: "Kgray44/treasurehuntSoT" } },
      },
    };
    const profile = ordinaryCheckoutProfile({
      baseSha,
      candidateSha,
      purpose: "campaign-custody",
      event: eventObject,
      env: {
        GITHUB_REPOSITORY: "Kgray44/treasurehuntSoT",
        GITHUB_SHA: baseSha,
        GITHUB_REF: "refs/heads/main",
        GITHUB_EVENT_NAME: "pull_request_target",
        GITHUB_JOB: "campaign-custody",
      },
    });
    need(
      JSON.stringify(roots) === JSON.stringify([...new Set([baseSha, candidateSha, ...profile.roots])]),
      "FIXED_ROOTS_CHANGED",
    );
    gitAt(["rev-list", "--objects", "--filter=blob:none", "--missing=error", ...roots]);
    const historicalMetadata = [
      ...new Map(
        [
          ...[...roots, ...profile.readerRevisions, ...EXPERIENCE_READER_REVISIONS].map((sha) => ({
            sha,
            type: "commit",
          })),
          ...EXPERIENCE_READER_OBJECTS.filter((row) => row.type === "commit" || row.type === "tree"),
        ].map((row) => [row.sha, { sha: row.sha, type: row.type }]),
      ).values(),
    ];
    const revisions = historicalMetadata.map((row) => row.sha);
    need(revisions.length <= 256 && revisions.every(oid), "READER_REVISION_BOUND");
    const checked = gitAt(["cat-file", "--batch-check"], Buffer.from(revisions.join("\n") + "\n"))
      .toString()
      .trim()
      .split(/\r?\n/u);
    need(
      checked.length === revisions.length &&
        checked.every((row, index) => row.startsWith(revisions[index] + " " + historicalMetadata[index].type + " ")),
      "HISTORICAL_READER_MISSING",
    );
    record("installed-source.original.json", {
      rows: installedRows,
      certificateRevision: NONCAMPAIGN_CUSTODY_CERTIFICATE_REVISION,
      roots,
      historicalMetadata,
      originalHistoricalReaders: EXPERIENCE_READER_OBJECTS,
      qualification: false,
    });
    const event = path.join(directory, "event.original.json"),
      output = path.join(directory, "reserve-output.original.txt"),
      network = path.join(directory, "reserve-network.original.json"),
      preload = path.join(directory, "deny.cjs");
    record("event.original.json", eventObject);
    retainCustodyProofFrame(preload, Buffer.from(custodyShadowPreload(network, git)));
    const ignored = new Set([output, network]),
      before = custodyProofFilesystem(root, ignored);
    const reserveArgs = [
      "--require",
      preload,
      fileURLToPath(new URL("./experience-exception.mjs", import.meta.url)),
      "--operation",
      "reserve",
      "--workspace",
      root,
      "--base",
      baseSha,
      "--candidate",
      candidateSha,
      "--evidence",
      path.join(root, ".git/noncampaign-forbidden-phase"),
    ];
    const result = spawnSync(process.execPath, reserveArgs, {
      cwd: root,
      env: { ...process.env, GITHUB_EVENT_PATH: event, GITHUB_SHA: baseSha, GITHUB_OUTPUT: output },
      encoding: null,
      maxBuffer: 65536,
      timeout: 30000,
      windowsHide: true,
    });
    const unchanged = custodyProofFilesystem(root, ignored) === before;
    const stdoutFrame = retain("reserve-stdout", result.stdout ?? Buffer.alloc(0)),
      stderrFrame = retain("reserve-stderr", result.stderr ?? Buffer.alloc(0));
    commands.push({
      executable: path.basename(process.execPath),
      cwd: root,
      args: reserveArgs,
      exitCode: result.status,
      signal: result.signal,
      frames: { stdout: stdoutFrame, stderr: stderrFrame },
      originalErrorPresent: !!result.error,
    });
    if (result.error) throw result.error;
    need(result.status === 0 && !result.signal && unchanged, "ACTUAL_RESERVE_FAILED_OR_WROTE_PHASE");
    const counter = JSON.parse(readCustodyPilotSource(network)),
      outputBytes = readCustodyPilotSource(output);
    need(
      outputBytes.equals(Buffer.from("campaign=false\n")) &&
        counter.fetchAttempts === 0 &&
        counter.networkAttempts === 0 &&
        counter.nonGitProcessAttempts === 0 &&
        Number.isSafeInteger(counter.gitCalls) &&
        counter.gitCalls > 0 &&
        counter.gitCalls <= 512,
      "ACTUAL_NEGATIVE_ROUTE_REQUIRED",
    );
    const proposal = {
      ...shadow,
      profile: CERTIFIED_CUSTODY_PROFILE,
      applied: true,
      sourceCertificate: "REVIEWED_INSTALLED_TRANSPORT_ONLY",
      qualification: false,
    };
    const proof = {
      status: "PASS_INSTALLED_NEGATIVE_CUSTODY",
      root,
      baseSha,
      candidateSha,
      prNumber,
      roots,
      certificateRevision: NONCAMPAIGN_CUSTODY_CERTIFICATE_REVISION,
      installedSourceDigest: hash(Buffer.from(JSON.stringify(installedRows))),
      profile: CERTIFIED_CUSTODY_PROFILE,
      proposalSha256: hash(Buffer.from(JSON.stringify(proposal))),
      certificateReaders,
      completeCommitTreeAncestry: true,
      filesystemUnchanged: unchanged,
      reserveOutputSha256: hash(outputBytes),
      ...counter,
      qualification: false,
    };
    record("original-frame-ledger.json", { frames, commands, retainedBytes, qualification: false });
    record("terminal.json", { ...proof, proposal });
    return proof;
  } catch (error) {
    try {
      record("original-frame-ledger.failure.json", {
        frames,
        commands,
        attemptedOriginalBytes: retainedBytes,
        completeOriginalRetention: false,
        qualification: false,
      });
      record("terminal.failure.json", {
        status: "FULL_REQUIRED",
        originalExceptionSerializationComplete: false,
        qualification: false,
      });
    } catch (retentionError) {
      throw new AggregateError([error, retentionError], "CUSTODY_PROOF_AND_RETENTION_FAILED", { cause: error });
    }
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse(readCustodyPilotSource(process.argv[2]));
    const proof = runInstalledNegativeCustodyProof(input);
    process.stdout.write(JSON.stringify(proof));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
