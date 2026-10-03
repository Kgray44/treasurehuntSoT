import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { labTool } from "./host";

const execute = promisify(execFile);
/** Ephemeral CI transport only. It never mutates the checkout, default branch, or protected testing authority. */
export async function dispatchLandfallHostedLab(
  candidate: string,
  root = process.cwd(),
  target = "all",
  tier = "development",
) {
  if (!/^[a-f0-9]{40}$/.test(candidate)) throw new Error("LANDFALL_HOSTED_CANDIDATE_INVALID");
  if (!["all", "provider", "android", "ios"].includes(target)) throw new Error("LANDFALL_HOSTED_TARGET_INVALID");
  if (!["development", "candidate", "closure"].includes(tier)) throw new Error("LANDFALL_HOSTED_TIER_INVALID");
  const androidProfiles = [
    { profile: "primary-phone", api: 36, device: "pixel_7", ram: "3072M" },
    ...(tier !== "development" ? [{ profile: "compatibility-phone", api: 35, device: "pixel_6", ram: "3072M" }] : []),
    ...(tier === "closure"
      ? [
          { profile: "low-resource", api: 36, device: "pixel_2", ram: "1536M" },
          { profile: "tablet", api: 36, device: "pixel_tablet", ram: "3072M" },
        ]
      : []),
  ];
  const appleProfiles = tier === "closure" ? ["primary-phone", "compatibility-phone", "tablet"] : ["primary-phone"];
  await labTool("git", ["cat-file", "-e", `${candidate}^{commit}`]);
  const template = await labTool("git", ["show", `${candidate}:.agents/landfall-device-lab-hosted.yml`]);
  const workflow = template
    .replaceAll("__CANDIDATE_SHA__", candidate)
    .replaceAll("__RUN_PROVIDERS__", String(target === "all" || target === "provider"))
    .replaceAll("__RUN_APPLE__", String(target === "all" || target === "ios"))
    .replaceAll("__RUN_ANDROID__", String(target === "all" || target === "android"))
    .replaceAll("__ANDROID_PROFILES__", JSON.stringify(androidProfiles))
    .replaceAll("__APPLE_PROFILES__", JSON.stringify(appleProfiles));
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
      target,
      tier,
      profiles: { android: androidProfiles, apple: appleProfiles },
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
  dispatchLandfallHostedLab(candidate, process.cwd(), process.argv[3] ?? "all", process.argv[4] ?? "development")
    .then((receipt) => process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`))
    .catch(() => {
      process.stderr.write("LANDFALL_HOSTED_DISPATCH_FAILED\n");
      process.exitCode = 1;
    });
}
