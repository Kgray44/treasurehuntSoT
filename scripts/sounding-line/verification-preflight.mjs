import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath, stat, statfs } from "node:fs/promises";
import path from "node:path";
const oid = (value) => /^[a-f0-9]{40}$/u.test(value ?? "");
const fail = (code) => {
  throw new Error(`SOUNDING_LINE_VERIFICATION_PREFLIGHT_${code}`);
};
export async function verificationPreflight({ root, authorityRoot, baseSha, candidateSha }) {
  if (!oid(baseSha) || !oid(candidateSha)) fail("IDENTITY_INVALID");
  root = await realpath(root);
  authorityRoot = await realpath(authorityRoot);
  const git = (args, cwd = root) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        GIT_NO_LAZY_FETCH: "1",
        GIT_NO_REPLACE_OBJECTS: "1",
        GIT_OPTIONAL_LOCKS: "0",
        GIT_TERMINAL_PROMPT: "0",
      },
    }).trim();
  if (git(["rev-parse", "HEAD"]) !== candidateSha) fail("HEAD_CHANGED");
  if (git(["rev-parse", "HEAD"], authorityRoot) !== baseSha) fail("AUTHORITY_CHANGED");
  try {
    git(
      ["diff", "--quiet", baseSha, "--", "scripts/sounding-line", "testing/sounding-line-authority.json"],
      authorityRoot,
    );
  } catch {
    fail("AUTHORITY_CONTENT_CHANGED");
  }
  git(["merge-base", "--is-ancestor", baseSha, candidateSha]);
  const tree = git(["rev-parse", `${candidateSha}^{tree}`]);
  let sourceInputBytes = 0;
  const boundedRead = async (file) => {
    const fullPath = path.join(authorityRoot, file);
    if ((await stat(fullPath)).size > 2 * 1024 * 1024) fail("INPUT_TOO_LARGE");
    const bytes = await readFile(fullPath);
    if (bytes.length > 2 * 1024 * 1024) fail("INPUT_TOO_LARGE");
    sourceInputBytes += bytes.length;
    return bytes;
  };
  const policyBytes = await boundedRead("testing/sounding-line-authority.json");
  const policy = JSON.parse(policyBytes);
  if (
    policy.authority !== "SOUNDING_LINE" ||
    policy.currentAuthorityVersion !== "1.4" ||
    policy.requiredProtectedAuthorityCheck !== "Sounding Line / Mainline Decision"
  )
    fail("POLICY_INCOMPATIBLE");
  const policyDigest = createHash("sha256").update(policyBytes).digest("hex");
  const controller = createHash("sha256");
  for (const file of [
    "ordinary.mjs",
    "ordinary-supervised.mjs",
    "verification-budget.mjs",
    "verification-preflight.mjs",
    "verification-supervisor.mjs",
    "owned-process.mjs",
    "owned-process-linux.py",
    "owned-process-windows.ps1",
  ])
    controller
      .update(file)
      .update("\0")
      .update(await boundedRead(`scripts/sounding-line/${file}`));
  const controllerDigest = controller.digest("hex");
  const resource = await statfs(root, { bigint: true });
  const availableBytes = resource.bavail * resource.bsize;
  if (availableBytes < 512n * 1024n * 1024n) fail("DISK_RESERVE_UNAVAILABLE");
  const identity = {
    version: 1,
    repository: "Kgray44/treasurehuntSoT",
    baseSha,
    candidateSha,
    tree,
    policyDigest,
    controllerDigest,
    runtime: process.version,
    platform: process.platform,
    architecture: process.arch,
  };
  return {
    ...identity,
    executionId: createHash("sha256").update(JSON.stringify(identity)).digest("hex"),
    availableBytes: availableBytes.toString(),
    sourceInputBytes,
    gitSubprocesses: 5,
    qualification: false,
  };
}
