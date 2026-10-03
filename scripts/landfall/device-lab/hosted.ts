import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { labTool } from "./host";

const execute = promisify(execFile);
/** Ephemeral CI transport only. It never mutates the checkout, default branch, or protected testing authority. */
export async function dispatchLandfallHostedLab(candidate: string, root = process.cwd()) {
  if (!/^[a-f0-9]{40}$/.test(candidate)) throw new Error("LANDFALL_HOSTED_CANDIDATE_INVALID");
  await labTool("git", ["cat-file", "-e", `${candidate}^{commit}`]);
  const template = await readFile(path.join(root, ".agents", "landfall-device-lab-hosted.yml"), "utf8");
  const workflow = template.replaceAll("__CANDIDATE_SHA__", candidate);
  const runId = `${candidate.slice(0, 12)}-${Date.now()}`;
  const destination = path.join(root, "artifacts", "landfall-device-lab", `hosted-${runId}`);
  await mkdir(destination, { recursive: true });
  const workflowFile = path.join(destination, "workflow.yml");
  await writeFile(workflowFile, workflow);
  const index = path.join(destination, "owned-index");
  const env = { ...process.env, GIT_INDEX_FILE: index };
  const git = async (args: string[]) =>
    (await execute("git", args, { cwd: root, env, windowsHide: true, maxBuffer: 1024 * 1024 })).stdout.trim();
  try {
    await git(["read-tree", candidate]);
    const blob = await git(["hash-object", "-w", workflowFile]);
    await git(["update-index", "--add", "--cacheinfo", `100644,${blob},.github/workflows/landfall-device-lab.yml`]);
    const tree = await git(["write-tree"]);
    const commit = await git(["commit-tree", tree, "-p", candidate, "-m", `Run Landfall Device Lab for ${candidate}`]);
    const branch = `codex/landfall-lab-${runId}`;
    await labTool("git", ["push", "origin", `${commit}:refs/heads/${branch}`], 120000);
    const receipt = {
      version: 1,
      candidateSha: candidate,
      transportSha: commit,
      transportTree: tree,
      branch,
      workflow: "landfall-device-lab.yml",
      createdAt: new Date().toISOString(),
      cleanup: "PENDING",
    };
    await writeFile(path.join(destination, "dispatch.json"), JSON.stringify(receipt, null, 2));
    return receipt;
  } finally {
    await rm(index, { force: true });
  }
}

if (process.argv[1]?.endsWith("hosted.ts")) {
  const candidate = process.argv[2] ?? "";
  dispatchLandfallHostedLab(candidate)
    .then((receipt) => process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`))
    .catch(() => {
      process.stderr.write("LANDFALL_HOSTED_DISPATCH_FAILED\n");
      process.exitCode = 1;
    });
}
