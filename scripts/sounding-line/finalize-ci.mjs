#!/usr/bin/env node
/* CI entrypoint: the finalizer alone decides whether collected evidence passes. */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";
import { finalize } from "./finalizer.mjs";

const [planPath, evidencePath] = process.argv.slice(2);
if (!planPath || !evidencePath) throw new Error("CI_FINALIZER_REQUIRES_PLAN_AND_EVIDENCE");
const readJson = async (file) => {
  const content = await readFile(file);
  const text = content[0] === 0xff && content[1] === 0xfe ? content.toString("utf16le") : content.toString("utf8");
  return JSON.parse(text.replace(/^\uFEFF/u, ""));
};
const plan = await readJson(path.resolve(planPath));
const { planDigest, ...unsignedPlan } = plan;
if (!planDigest || planDigest !== createHash("sha256").update(JSON.stringify(unsignedPlan)).digest("hex"))
  throw new Error("CI_PLAN_DIGEST_MISMATCH");
const evidenceRoot = path.resolve(evidencePath);
const evidencePaths = await readdir(evidenceRoot, { recursive: true })
  .then((files) =>
    files
      .filter((file) => path.basename(file) === "sounding-line-worker-evidence.json")
      .map((file) => path.join(evidenceRoot, file)),
  )
  .catch((error) => {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    return [evidenceRoot];
  });
const evidence = await Promise.all(
  evidencePaths.map((file) =>
    readJson(file).catch((error) =>
      error?.code === "ENOENT"
        ? { version: 1, plan: { planDigest: plan.planDigest }, receipts: [] }
        : Promise.reject(error),
    ),
  ),
);
if (evidence.some((item) => item.plan?.planDigest !== plan.planDigest)) throw new Error("CI_EVIDENCE_PLAN_MISMATCH");
if (process.env.GITHUB_SHA && plan.sourceSha !== process.env.GITHUB_SHA) throw new Error("CI_PLAN_SOURCE_MISMATCH");
const result = finalize({ plan, receipts: evidence.flatMap((item) => item.receipts) });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.decision === "RELEASE_GO" ? 0 : 1;
