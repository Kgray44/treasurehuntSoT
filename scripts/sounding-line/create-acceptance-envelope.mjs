#!/usr/bin/env node
/* Seal finalizer output with the PR/base identity needed by the merge bridge. */
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const required = (name) => {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`ACCEPTANCE_ENVELOPE_${name.slice(2).toUpperCase()}_REQUIRED`);
  return value;
};
const plan = await readJson(required("--plan"));
const finalization = await readJson(required("--finalization"));
const prNumber = Number(required("--pr-number"));
const baseSha = required("--base-sha");
const runId = Number(required("--run-id"));
const output = required("--out");
if (!Number.isSafeInteger(prNumber) || prNumber < 1 || !Number.isSafeInteger(runId) || runId < 1)
  throw new Error("ACCEPTANCE_ENVELOPE_IDENTITY_INVALID");
if (!/^[0-9a-f]{40}$/u.test(baseSha) || !/^[0-9a-f]{40}$/u.test(plan.sourceSha) || !/^[0-9a-f]{40}$/u.test(plan.qualifiedBaseTreeSha))
  throw new Error("ACCEPTANCE_ENVELOPE_SHA_INVALID");
if (finalization.authority !== "SOUNDING_LINE_FINALIZER" || finalization.decision !== "RELEASE_GO")
  throw new Error("ACCEPTANCE_ENVELOPE_FINALIZER_DECISION_INVALID");
if (finalization.planDigest !== plan.planDigest || !Array.isArray(finalization.receipts))
  throw new Error("ACCEPTANCE_ENVELOPE_FINALIZATION_INVALID");
await writeFile(
  output,
  `${JSON.stringify(
    {
      version: 1,
      authority: "SOUNDING_LINE_ACCEPTANCE_ENVELOPE",
      authoritativeRunId: runId,
      prNumber,
      candidateSha: plan.sourceSha,
      qualifiedBaseSha: baseSha,
      qualifiedBaseTreeSha: plan.qualifiedBaseTreeSha,
      gate: "mainline",
      planDigest: plan.planDigest,
      policyDigest: plan.policyDigest,
      inventoryDigest: plan.inventoryDigest,
      authorityDigest: plan.authorityDigest,
      evidenceDigest: finalization.evidenceDigest,
      mandatoryReceiptCount: finalization.receipts.length,
      finalizerAuthority: finalization.authority,
      finalizerDecision: finalization.decision,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
