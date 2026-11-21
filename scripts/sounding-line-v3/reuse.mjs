import { createHash } from "node:crypto";
import { git } from "./plan.mjs";

const standaloneDocs = new Set(["README.md", "CHANGELOG.md"]);

export function reusableSource(file) {
  return !standaloneDocs.has(file);
}

export function suiteCacheKey(job, tree, pr) {
  if (!Number.isSafeInteger(pr) || !/^unit\.(?:wayfarer|landfall)$/.test(job.id)) return "";
  const content = git(["ls-tree", "-rz", tree])
    .split("\0")
    .filter(Boolean)
    .filter((entry) => reusableSource(entry.slice(entry.indexOf("\t") + 1)));
  const hash = createHash("sha256")
    .update(
      JSON.stringify([job, process.version, process.env.ImageOS ?? process.platform, process.env.RUNNER_ARCH, content]),
    )
    .digest("hex");
  return "sl-v3-pass-" + pr + "-" + hash;
}
