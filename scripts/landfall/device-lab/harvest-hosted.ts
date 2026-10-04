import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { labTool } from "./host";

/** Recover source-bound artifacts before removing only the unchanged transport branch we created. */
export async function harvestLandfallHostedLab(runId: string, dispatchFile: string) {
  if (!/^[0-9]{1,20}$/.test(runId)) throw new Error("LANDFALL_HOSTED_RUN_INVALID");
  const root = process.cwd();
  const owned = path.join(root, "artifacts", "landfall-device-lab");
  const file = path.resolve(dispatchFile);
  const relative = path.relative(owned, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("LANDFALL_HOSTED_RECEIPT_PATH_INVALID");
  const dispatch = JSON.parse(await readFile(file, "utf8"));
  if (
    !/^[a-f0-9]{40}$/.test(dispatch.candidateSha) ||
    !/^[a-f0-9]{40}$/.test(dispatch.transportSha) ||
    !new RegExp(`^codex/landfall-lab-${dispatch.candidateSha.slice(0, 12)}-[0-9]+$`).test(dispatch.branch)
  )
    throw new Error("LANDFALL_HOSTED_DISPATCH_INVALID");
  const run = JSON.parse(await labTool("gh", ["run", "view", runId, "--json", "headSha,status,conclusion,url"]));
  if (run.headSha !== dispatch.transportSha) throw new Error("LANDFALL_HOSTED_SOURCE_MISMATCH");
  if (run.status !== "completed") return { state: "PENDING", url: run.url };
  if ((await labTool("git", ["rev-parse", `${dispatch.transportSha}^`])).trim() !== dispatch.candidateSha)
    throw new Error("LANDFALL_HOSTED_PARENT_MISMATCH");
  const directory = path.join(path.dirname(file), `run-${runId}`);
  await mkdir(directory, { recursive: true });
  const artifactDirectory = path.join(directory, "artifacts");
  await mkdir(artifactDirectory, { recursive: true });
  const inventory = JSON.parse(await labTool("gh", ["api", `repos/{owner}/{repo}/actions/runs/${runId}/artifacts`]));
  if (!Array.isArray(inventory.artifacts)) throw new Error("LANDFALL_HOSTED_ARTIFACT_INVENTORY_INVALID");
  const artifactState = inventory.artifacts.length ? "AVAILABLE" : "NOT_PRODUCED";
  // Setup failures can finish before the first receipt exists. Retain their
  // source-bound CI log and truthful zero-artifact state, then clean transport.
  // A failed download with an existing artifact remains an error.
  // Complete multi-profile Apple xcresult bundles can exceed the smaller
  // diagnostic artifact transfer window. Bound transport, not scenario behavior.
  if (inventory.artifacts.length) {
    // gh rejects existing extracted files. A retry downloads into a fresh owned
    // sibling and preserves the prior partial transfer; it never deletes proof.
    const transfer = path.join(directory, `artifact-transfer-${randomUUID()}`);
    const prior = path.join(directory, `artifact-transfer-prior-${randomUUID()}`);
    if ([transfer, prior, artifactDirectory].some((target) => path.dirname(target) !== directory))
      throw new Error("LANDFALL_HOSTED_TRANSFER_PATH_INVALID");
    await mkdir(transfer);
    await labTool("gh", ["run", "download", runId, "--dir", transfer], 600000);
    await rename(artifactDirectory, prior);
    await rename(transfer, artifactDirectory);
  }
  await writeFile(path.join(directory, "run.log"), await labTool("gh", ["run", "view", runId, "--log"], 120000));
  const artifacts: { path: string; sha256: string }[] = [];
  const collect = async (folder: string) => {
    for (const item of await readdir(folder, { withFileTypes: true })) {
      const location = path.join(folder, item.name);
      if (item.isDirectory()) await collect(location);
      else if (item.isFile())
        artifacts.push({
          path: path.relative(directory, location).replaceAll("\\", "/"),
          sha256: createHash("sha256")
            .update(await readFile(location))
            .digest("hex"),
        });
    }
  };
  await collect(artifactDirectory);
  const ref = `refs/heads/${dispatch.branch}`;
  const remote = (await labTool("git", ["ls-remote", "origin", ref])).trim();
  if (remote && remote.split(/\s+/)[0] !== dispatch.transportSha) throw new Error("LANDFALL_HOSTED_BRANCH_CHANGED");
  if (remote) await labTool("git", ["push", "origin", "--delete", dispatch.branch], 120000);
  if ((await labTool("git", ["ls-remote", "origin", ref])).trim()) throw new Error("LANDFALL_HOSTED_CLEANUP_FAILED");
  const receipt = {
    version: 1,
    candidateSha: dispatch.candidateSha,
    transportSha: dispatch.transportSha,
    runId,
    url: run.url,
    conclusion: run.conclusion,
    artifacts,
    artifactState,
    cleanup: { result: "PASS", ownedResources: [ref], remainingResources: [] },
  };
  await writeFile(path.join(directory, "hosted-receipt.json"), JSON.stringify(receipt, null, 2));
  await writeFile(
    file,
    JSON.stringify({ ...dispatch, runId, url: run.url, cleanup: "PASS", harvested: directory }, null, 2),
  );
  return { state: "HARVESTED", conclusion: run.conclusion, artifacts: artifacts.length, directory };
}
if (process.argv[1]?.endsWith("harvest-hosted.ts"))
  harvestLandfallHostedLab(process.argv[2], process.argv[3])
    .then((receipt) => process.stdout.write(`${JSON.stringify(receipt)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : "LANDFALL_HOSTED_HARVEST_FAILED"}\n`);
      process.exitCode = 1;
    });
