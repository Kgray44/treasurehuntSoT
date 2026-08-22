/* Safely discover the sealed Root Maintenance qualification payload. */
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

const requiredFiles = ["root-maintenance-plan.json", "root-maintenance-finalization.json"];

const fail = (code, detail = "") => {
  throw new Error(detail ? `${code}:${detail}` : code);
};

const inside = (root, target) => target === root || target.startsWith(`${root}${path.sep}`);

export async function assertSafeRootMaintenanceArtifactPath(root, candidate) {
  const trustedRoot = await realpath(root);
  const resolved = path.resolve(candidate);
  if (!inside(trustedRoot, resolved)) fail("ROOT_MAINTENANCE_ARTIFACT_OUT_OF_ROOT", resolved);
  return { trustedRoot, resolved };
}

export async function discoverSealedRootMaintenanceArtifact(root) {
  const trustedRoot = await realpath(root);
  const rootStat = await lstat(trustedRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail("ROOT_MAINTENANCE_ARTIFACT_ROOT_INVALID");
  const found = new Map(requiredFiles.map((name) => [name, []]));

  async function visit(directory) {
    const directoryReal = await realpath(directory);
    if (!inside(trustedRoot, directoryReal)) fail("ROOT_MAINTENANCE_ARTIFACT_OUT_OF_ROOT", directoryReal);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      const stat = await lstat(candidate);
      if (stat.isSymbolicLink()) fail("ROOT_MAINTENANCE_ARTIFACT_SYMLINK_REJECTED", entry.name);
      if (stat.isDirectory()) {
        await visit(candidate);
        continue;
      }
      if (!stat.isFile() || !found.has(entry.name)) continue;
      const candidateReal = await realpath(candidate);
      if (!inside(trustedRoot, candidateReal)) fail("ROOT_MAINTENANCE_ARTIFACT_OUT_OF_ROOT", candidateReal);
      found.get(entry.name).push(candidateReal);
    }
  }

  await visit(trustedRoot);
  const files = {};
  for (const name of requiredFiles) {
    const matches = found.get(name);
    if (matches.length === 0) fail("ROOT_MAINTENANCE_ARTIFACT_REQUIRED_FILE_MISSING", name);
    if (matches.length !== 1) fail("ROOT_MAINTENANCE_ARTIFACT_REQUIRED_FILE_AMBIGUOUS", name);
    files[name] = matches[0];
  }
  return files;
}

const parse = async (file) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    fail("ROOT_MAINTENANCE_ARTIFACT_JSON_INVALID", path.basename(file));
  }
};

export async function readSealedRootMaintenanceArtifact(root) {
  const files = await discoverSealedRootMaintenanceArtifact(root);
  return {
    files,
    plan: await parse(files["root-maintenance-plan.json"]),
    finalization: await parse(files["root-maintenance-finalization.json"]),
  };
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const result = await readSealedRootMaintenanceArtifact(process.argv[2]);
  console.log(JSON.stringify(result, null, 2));
}
