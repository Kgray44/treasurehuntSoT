import { createHash } from "node:crypto";
import { git } from "./plan.mjs";

const standaloneDocs = new Set(["README.md", "CHANGELOG.md"]);
const projectCss = /^src\/(?:components\/)?(wayfarer|landfall)\/.*\.css$/;

export function reusableSource(file, jobId) {
  if (standaloneDocs.has(file)) return false;
  const owner = /^unit\.(wayfarer|landfall)$/.exec(jobId)?.[1];
  const stylesheetOwner = projectCss.exec(file)?.[1];
  return !owner || !stylesheetOwner || owner === stylesheetOwner;
}

export function suiteCacheKey(job, tree, pr) {
  if (!Number.isSafeInteger(pr) || !/^unit\.(?:wayfarer|landfall)$/.test(job.id)) return "";
  const content = git(["ls-tree", "-rz", tree]).split("\0").filter(Boolean)
    .filter((entry) => reusableSource(entry.slice(entry.indexOf("\t") + 1), job.id));
  const hash = createHash("sha256").update(JSON.stringify([
    job, process.version, process.env.ImageVersion, process.env.RUNNER_ARCH, content,
  ])).digest("hex");
  return "sl-v3-pass-" + pr + "-" + hash;
}
