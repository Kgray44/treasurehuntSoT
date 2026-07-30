#!/usr/bin/env node
/* CI entrypoint: the finalizer alone decides whether collected evidence passes. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { finalize } from "./finalizer.mjs";

const [planPath, evidencePath] = process.argv.slice(2);
if (!planPath || !evidencePath) throw new Error("CI_FINALIZER_REQUIRES_PLAN_AND_EVIDENCE");
const plan = JSON.parse(await readFile(path.resolve(planPath), "utf8"));
const evidence = await readFile(path.resolve(evidencePath), "utf8")
  .then(JSON.parse)
  .catch((error) => {
    if (error?.code !== "ENOENT") throw error;
    return { version: 1, plan: { planDigest: plan.planDigest }, receipts: [] };
  });
if (evidence.plan?.planDigest !== plan.planDigest) throw new Error("CI_EVIDENCE_PLAN_MISMATCH");
if (process.env.GITHUB_SHA && plan.sourceSha !== process.env.GITHUB_SHA) throw new Error("CI_PLAN_SOURCE_MISMATCH");
const result = finalize({ plan, receipts: evidence.receipts });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.decision === "RELEASE_GO" ? 0 : 1;
