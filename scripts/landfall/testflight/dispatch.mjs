import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

// A one-file workflow transport; the checked-out product remains the exact candidate.
// No push occurs without --publish. This never updates main or PR #741.
export function validateInputs({ candidate, mode, origin, version, build }) {
  if (!/^[0-9a-f]{40}$/.test(candidate ?? "")) throw new Error("NCL01_CANDIDATE_INVALID");
  if (!["unsigned", "upload", "observe"].includes(mode)) throw new Error("NCL01_MODE_INVALID");
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new Error("NCL01_HTTPS_ORIGIN_REQUIRED");
  // This origin is also rendered in a quoted workflow shell argument. A URL
  // parser alone accepts characters such as apostrophes in a hostname.
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(url.hostname)) throw new Error("NCL01_ORIGIN_HOST_INVALID");
  if (!/^[A-Za-z0-9.:-]+$/.test(url.host)) throw new Error("NCL01_ORIGIN_HOST_INVALID");
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version ?? "")) throw new Error("NCL01_VERSION_INVALID");
  if (!/^[1-9][0-9]{0,3}(\.[0-9]{1,2}){0,2}$/.test(build ?? "")) throw new Error("NCL01_BUILD_INVALID");
  return { candidate, mode, origin: url.origin, version, build };
}

export function renderWorkflow(template, input) {
  const values = validateInputs(input);
  const replacements = {
    __CANDIDATE_SHA__: values.candidate,
    __ORIGIN__: values.origin,
    __VERSION__: values.version,
    __BUILD__: values.build,
    __MODE__: values.mode,
    __UPLOAD__: String(values.mode !== "unsigned"),
    __UNSIGNED__: String(values.mode === "unsigned"),
  };
  let result = template;
  for (const [key, value] of Object.entries(replacements)) result = result.replaceAll(key, value);
  if (/__[A-Z_]+__/.test(result)) throw new Error("NCL01_TEMPLATE_UNRESOLVED");
  return result;
}

export function dispatch(input, { root = process.cwd(), publish = false } = {}) {
  const values = validateInputs(input);
  const git = (args, env = process.env) =>
    execFileSync("git", args, { cwd: root, env, encoding: "utf8", windowsHide: true }).trim();
  git(["cat-file", "-e", `${values.candidate}^{commit}`]);
  const template = git(["show", `${values.candidate}:.agents/ncl01-testflight-hosted.yml`]);
  const workflow = renderWorkflow(template, values);
  const outputRoot = path.join(root, "artifacts", "ncl01-testflight");
  mkdirSync(outputRoot, { recursive: true });
  const destination = mkdtempSync(path.join(outputRoot, `${values.mode}-${values.candidate.slice(0, 12)}-`));
  const workflowPath = path.join(destination, "workflow.yml");
  writeFileSync(workflowPath, workflow);
  const receipt = {
    schemaVersion: 1,
    ...values,
    teamId: "X2JZ9N65V2",
    bundleId: "com.voyagewright.landfall",
    publish,
    physicalInstallationProven: false,
    physicalARProven: false,
  };
  if (publish) {
    const index = path.join(destination, "owned-index");
    const env = { ...process.env, GIT_INDEX_FILE: index };
    try {
      git(["read-tree", values.candidate], env);
      const blob = git(["hash-object", "-w", workflowPath], env);
      git(["update-index", "--add", "--cacheinfo", `100644,${blob},.github/workflows/ncl01-testflight.yml`], env);
      const tree = git(["write-tree"], env);
      const transport = git(
        [
          "commit-tree",
          tree,
          "-p",
          values.candidate,
          "-m",
          `Run isolated NCL-01 ${values.mode} for ${values.candidate}`,
        ],
        env,
      );
      if (git(["diff", "--name-only", values.candidate, transport], env) !== ".github/workflows/ncl01-testflight.yml")
        throw new Error("NCL01_TRANSPORT_SCOPE_INVALID");
      const branch = `codex/ncl01-testflight-${values.mode}-${values.candidate.slice(0, 12)}-${Date.now()}`;
      git(["push", "origin", `${transport}:refs/heads/${branch}`], env);
      Object.assign(receipt, { transportSha: transport, transportTree: tree, branch, cleanup: "PENDING" });
    } finally {
      rmSync(index, { force: true });
    }
  }
  writeFileSync(path.join(destination, "dispatch.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  return { ...receipt, receiptPath: path.join(destination, "dispatch.json") };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    const [candidate, mode, origin, version, build, flag] = process.argv.slice(2);
    if (flag && flag !== "--publish") throw new Error("NCL01_OPTION_INVALID");
    console.log(
      JSON.stringify(dispatch({ candidate, mode, origin, version, build }, { publish: flag === "--publish" }), null, 2),
    );
  } catch (error) {
    console.error(
      error instanceof Error && /^NCL01_[A-Z_]+$/.test(error.message) ? error.message : "NCL01_DISPATCH_FAILED",
    );
    process.exitCode = 1;
  }
}
