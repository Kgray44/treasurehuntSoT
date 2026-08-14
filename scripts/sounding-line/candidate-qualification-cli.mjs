import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createTrustedCandidatePlan, sealTrustedCandidatePlan } from "./candidate-qualification.mjs";

const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1] ?? null;
const values = (name) => args.flatMap((item, index) => (item === name ? [args[index + 1]] : [])).filter(Boolean);
const plan = sealTrustedCandidatePlan(
  await createTrustedCandidatePlan({
    authorityRoot: path.resolve(value("--authority-root") ?? ""),
    candidateRoot: path.resolve(value("--candidate-root") ?? ""),
    authoritySourceSha: value("--authority-source-sha"),
    authoritySourceTree: value("--authority-source-tree"),
    candidateHeadSha: value("--candidate-head-sha"),
    candidateTreeSha: value("--candidate-tree-sha"),
    qualifiedBaseSha: value("--qualified-base-sha"),
    predictedIntegrationTree: value("--predicted-integration-tree"),
    gate: value("--gate") ?? "mainline",
    changedPaths: values("--changed-path"),
  }),
);
const output = value("--out");
if (output) await writeFile(output, `${JSON.stringify(plan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
