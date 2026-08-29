import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { LocalCommunityAssetStorage } from "@/community/storage";

async function main() {
  const root = process.env.COMMUNITY_ASSET_ROOT;
  if (!root || !path.isAbsolute(root)) throw new Error("COMMUNITY_ASSET_ROOT must be an absolute task-owned path.");
  const resolvedRoot = path.resolve(root);
  const repository = path.resolve(process.cwd());
  if (resolvedRoot === repository || resolvedRoot.startsWith(`${repository}${path.sep}`))
    throw new Error("COMMUNITY_ASSET_ROOT must remain outside the repository.");

  const owner = `smoke-${randomUUID().replaceAll("-", "")}`;
  const name = "readiness.txt";
  const bytes = Buffer.from("Harborlight local storage readiness probe", "utf8");
  const storage = new LocalCommunityAssetStorage(resolvedRoot);
  const staged = await storage.putStagedObject(owner, name, bytes);
  try {
    const read = await storage.readObject(staged.key);
    if (!read.equals(bytes)) throw new Error("COMMUNITY_STORAGE_SMOKE_READ_MISMATCH");
    process.stdout.write(`${JSON.stringify({ mode: "SIMULATED_LOCAL", writeRead: "SUCCEEDED" })}\n`);
  } finally {
    await rm(path.join(resolvedRoot, staged.key), { force: true });
  }
}

void main();
