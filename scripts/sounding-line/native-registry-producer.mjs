// Explicitly requested shadow custody; never acceptance or browser reuse.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readInstalledNativeEvidenceContext } from "./native-evidence-context.mjs";
import { readBoundedRegistryFile, sealClosedContextRegistryFiles } from "./closed-context-registry-files.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const need = (value, code) => {
  if (!value) throw Error(`SOUNDING_LINE_NATIVE_REGISTRY_PRODUCER_${code}`);
};
const positive = (value) =>
  typeof value === "string" && /^[1-9][0-9]{0,15}$/u.test(value) && Number.isSafeInteger(Number(value));
const environment = () => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
  GIT_NO_LAZY_FETCH: "1",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_NO_REPLACE_OBJECTS: "1",
  GIT_TERMINAL_PROMPT: "0",
  GH_PROMPT_DISABLED: "1",
});
const git = (cwd, args, encoding = "utf8") =>
  execFileSync("git", ["-c", "core.fsmonitor=false", "-c", "protocol.allow=never", ...args], {
    cwd,
    encoding,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10000,
    maxBuffer: 2 * 1024 * 1024,
    env: environment(),
  });
async function installedSource(baseSha) {
  need(git(root, ["rev-parse", "HEAD"]).trim() === baseSha, "INSTALLED_BASE");
  const entries = git(root, ["ls-tree", "-rz", baseSha, "--", "scripts/sounding-line"], null)
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  need(entries.length > 0 && entries.length <= 4096, "SOURCE_BOUND");
  let total = 0;
  for (const entry of entries) {
    const match = /^100644 blob ([a-f0-9]{40})\t(scripts\/sounding-line\/[A-Za-z0-9_.-]+)$/u.exec(entry);
    need(match, "SOURCE_MODE");
    const bytes = await readBoundedRegistryFile({ root, file: match[2], maximumBytes: 1024 * 1024 });
    total += bytes.length;
    need(
      total <= 16 * 1024 * 1024 &&
        createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") === match[1],
      "SOURCE_CONTENT",
    );
  }
}
function options(argv) {
  const allowed = ["workspace", "plan", "stage", "runtimes", "supervision", "raw-artifact", "lifecycle-artifact"],
    result = {};
  need(argv.length === allowed.length * 2, "ARGUMENTS");
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.slice(2),
      value = argv[index + 1];
    need(
      argv[index]?.startsWith("--") &&
        allowed.includes(key) &&
        !Object.hasOwn(result, key) &&
        typeof value === "string" &&
        value.length > 0 &&
        Buffer.byteLength(value) <= 65536,
      "ARGUMENTS",
    );
    result[key] = value;
  }
  return result;
}
function providerArtifact(id, name, context, maximumBytes) {
  need(positive(id), "ARTIFACT_ID");
  const bytes = execFileSync(
    "gh",
    ["api", "--hostname", "github.com", `repos/Kgray44/treasurehuntSoT/actions/artifacts/${id}`],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], timeout: 5000, maxBuffer: 1024 * 1024, env: environment() },
  );
  const artifact = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  need(
    artifact.id === Number(id) &&
      artifact.name === name &&
      artifact.expired === false &&
      Number.isSafeInteger(artifact.size_in_bytes) &&
      artifact.size_in_bytes > 0 &&
      artifact.size_in_bytes <= maximumBytes &&
      /^sha256:[a-f0-9]{64}$/u.test(artifact.digest ?? ""),
    "ARTIFACT_METADATA",
  );
  need(
    artifact.workflow_run?.id === context.runId &&
      artifact.workflow_run.repository_id === 1303074266 &&
      artifact.workflow_run.head_repository_id === 1303074266 &&
      artifact.workflow_run.head_sha === context.baseSha &&
      artifact.workflow_run.head_branch === "main",
    "ARTIFACT_SOURCE",
  );
  return { id: artifact.id, archiveSha256: artifact.digest.slice(7) };
}
async function newOutputDirectory(relative) {
  let selected = root;
  for (const component of relative.split("/")) {
    selected = path.join(selected, component);
    try {
      await fs.mkdir(selected, { mode: 0o700 });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const stat = await fs.lstat(selected);
    need(
      stat.isDirectory() && !stat.isSymbolicLink() && (await fs.realpath(selected)) === selected,
      "OUTPUT_DIRECTORY",
    );
  }
  return selected;
}
async function main() {
  const context = readInstalledNativeEvidenceContext();
  need(
    context.kind === "NATIVE_ORIGINAL_EVIDENCE_CONTEXT_SHADOW" &&
      context.jobKey === "experience-preparation" &&
      ["capture", "capture-diagnostic"].includes(context.mode) &&
      process.env.SOUNDING_LINE_INCREMENTAL_EVIDENCE_SHADOW === "true",
    "OPT_IN_CONTEXT",
  );
  const input = options(process.argv.slice(2));
  await installedSource(context.baseSha);
  const workspace = await fs.realpath(input.workspace);
  need(workspace === path.resolve(root, "../candidate") && input.workspace === "candidate", "WORKSPACE");
  need(git(workspace, ["rev-parse", "HEAD"]).trim() === context.candidateSha, "CANDIDATE");
  const local = (value) => {
    need(
      value.startsWith("candidate/") &&
        !/[\\\u0000-\u001f\u007f]/u.test(value) &&
        value.split("/").every((part) => part && part !== "." && part !== ".."),
      "CANDIDATE_PATH",
    );
    return value.slice("candidate/".length);
  };
  const planPath = local(input.plan),
    stagePath = local(input.stage);
  need(
    /^artifacts\/sounding-line\/product-experience-submission\/[A-Za-z0-9_./-]+\/plan\.json$/u.test(planPath) ||
      /^artifacts\/sounding-line\/product-experience-submission\/plan\.json$/u.test(planPath),
    "PLAN_SCOPE",
  );
  need(
    /^artifacts\/sounding-line\/product-experience-capture-staging\/capture-[A-Za-z0-9_-]+\/capture$/u.test(stagePath),
    "STAGE_SCOPE",
  );
  const plan = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      await readBoundedRegistryFile({ root: workspace, file: planPath, maximumBytes: 2 * 1024 * 1024 }),
    ),
  );
  need(
    plan.baseSha === context.baseSha &&
      plan.candidateSha === context.candidateSha &&
      !plan.exception &&
      !plan.paired &&
      !plan.pairedOnly,
    "PLAN_BINDING",
  );
  plan.prNumber = context.prNumber;
  const supervision = input.supervision.startsWith("authority/") ? input.supervision.slice("authority/".length) : "";
  need(
    /^artifacts\/sounding-line\/preparation-supervision\/session-[A-Za-z0-9_-]+\/public$/u.test(supervision),
    "SUPERVISION_SCOPE",
  );
  let terminalPath = `${supervision}/terminal.json`;
  try {
    await fs.lstat(path.join(root, supervision, "terminal-correction.json"));
    terminalPath = `${supervision}/terminal-correction.json`;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const terminal = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      await readBoundedRegistryFile({ root, file: terminalPath, maximumBytes: 65536 }),
    ),
  );
  need(
    terminal.version === 1 &&
      terminal.binding?.repository === context.repository &&
      terminal.binding.base === context.baseSha &&
      terminal.binding.candidate === context.candidateSha &&
      terminal.binding.runId === String(context.runId) &&
      terminal.binding.attempt === String(context.attempt) &&
      terminal.observerClosed === true &&
      terminal.cleanup?.status === "PASS" &&
      terminal.cleanup.treeReaped === true &&
      terminal.cleanup.streamsClosed === true &&
      terminal.cleanup.directExitObserved === true &&
      terminal.cleanup.ownership === "LINUX_SUBREAPER_AND_PIDFD",
    "PARENT_CLEANUP",
  );
  const rawArtifact = providerArtifact(
    input["raw-artifact"],
    `product-experience-raw-${context.candidateSha}-${context.runId}`,
    context,
    512 * 1024 * 1024,
  );
  const lifecycleArtifact = providerArtifact(
    input["lifecycle-artifact"],
    `product-experience-lifecycle-${context.candidateSha}-${context.runId}`,
    context,
    32 * 1024 * 1024,
  );
  const cleanupPaths = input.runtimes.split(/\r?\n/u).filter(Boolean).map(local);
  const sourceTree = git(workspace, ["rev-parse", "HEAD^{tree}"]).trim();
  const declared = (classification) => hash(JSON.stringify({ classification, sourceDigest: plan.sourceDigest }));
  const sealed = await sealClosedContextRegistryFiles({
    captureMode: context.mode,
    root: workspace,
    rawDirectory: stagePath.slice(0, -"capture".length) + "raw",
    cleanupPaths,
    plan,
    producer: {
      repository: context.repository,
      runId: context.runId,
      attempt: context.attempt,
      workflowSha: context.baseSha,
    },
    sourceTree,
    controllerDigest: hash(await fs.readFile(fileURLToPath(import.meta.url))),
    rawArtifact,
    lifecycleArtifact,
    definitionObservations: {
      fixtureDigest: declared("UNATTESTED_SHARED_FIXTURE"),
      toolchainDigest: hash(JSON.stringify({ node: process.version, class: "DECLARED_TOOLCHAIN_NOT_CERTIFIED" })),
      browserDigest: declared("BROWSER_BINARY_NOT_CERTIFIED"),
      environmentDigest: declared("EXTERNAL_ENVIRONMENT_NOT_CERTIFIED"),
    },
  });
  await installedSource(context.baseSha);
  const relative = `artifacts/sounding-line/context-registry-shadow/run-${context.runId}-${context.attempt}`;
  const output = await newOutputDirectory(relative);
  await fs.writeFile(path.join(output, "registry-v2.encrypted"), sealed.encrypted, { flag: "wx", mode: 0o600 });
  const receipt = {
    version: 2,
    classification: "SHADOW_CONTEXT_REGISTRY_SEALED_NOT_ACCEPTANCE",
    runId: context.runId,
    attempt: context.attempt,
    baseSha: context.baseSha,
    candidateSha: context.candidateSha,
    completedContexts: sealed.completedContexts,
    artifactCount: sealed.artifactCount,
    bytes: sealed.encrypted.length,
    encryptedSha256: hash(sealed.encrypted),
    qualification: false,
    reuseAuthorized: false,
  };
  await fs.writeFile(path.join(output, "status.json"), JSON.stringify(receipt) + "\n", { flag: "wx", mode: 0o600 });
  need(typeof process.env.GITHUB_OUTPUT === "string", "OUTPUT_CHANNEL");
  await fs.appendFile(
    process.env.GITHUB_OUTPUT,
    `context_registry_encrypted_path=authority/${relative}/registry-v2.encrypted\n`,
  );
  console.log(JSON.stringify(receipt));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    const code = /^SOUNDING_LINE_[A-Z0-9_]+$/u.test(error?.message ?? "")
      ? error.message
      : "SOUNDING_LINE_NATIVE_REGISTRY_PRODUCER_UNAVAILABLE";
    console.log(
      JSON.stringify({
        version: 2,
        classification: "SHADOW_CONTEXT_REGISTRY_UNAVAILABLE",
        code,
        qualification: false,
        reuseAuthorized: false,
      }),
    );
  }
}
