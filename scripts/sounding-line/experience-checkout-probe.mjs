// Noncapturing installed-workflow checkout proof. No network, custody or decision writes.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  trustedExceptions,
  campaignRelated,
  CROSSDECK_R4,
  CROSSDECK_R5,
  CROSSDECK_R6,
} from "./experience-exception.mjs";

export function checkoutProbe({ root, baseSha, candidateSha, environment = process.env }) {
  const fail = () => {
    throw new Error("SOUNDING_LINE_CUSTODY_PROBE_IDENTITY_OR_SCOPE_CHANGED");
  };
  if (
    !/^[a-f0-9]{40}$/u.test(baseSha ?? "") ||
    baseSha !== candidateSha ||
    environment.GITHUB_SHA !== baseSha ||
    environment.GITHUB_REF !== "refs/heads/main" ||
    environment.GITHUB_ACTIONS !== "true" ||
    environment.GITHUB_JOB !== "campaign-custody" ||
    environment.GITHUB_RUN_ATTEMPT !== "1" ||
    environment.GITHUB_ACTOR !== "Kgray44" ||
    environment.GITHUB_TRIGGERING_ACTOR !== "Kgray44"
  )
    fail();
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (git("rev-parse", "HEAD") !== baseSha || git("rev-parse", "--is-shallow-repository") !== "false") fail();
  const records = trustedExceptions(root, baseSha);
  if (
    records.some((record) =>
      campaignRelated({ root, baseSha, candidateSha, record, prNumber: environment.SOUNDING_LINE_PR_NUMBER }),
    )
  )
    fail();
  const expected = records.some((r) => r.id === CROSSDECK_R6.id)
    ? CROSSDECK_R6
    : records.some((r) => r.id === CROSSDECK_R5.id)
      ? CROSSDECK_R5
      : CROSSDECK_R4;
  const record = records.find((r) => r.id === expected.id);
  if (!record || record.frozenReferenceSha !== expected.frozenReferenceSha) fail();
  git("merge-base", "--is-ancestor", record.predecessor.candidateSha, record.frozenReferenceSha);
  git("merge-base", "--is-ancestor", record.predecessor.baseSha, baseSha);
  for (const [file, tree] of Object.entries(record.frozenTrees))
    if (git("rev-parse", `${record.frozenReferenceSha}:${file}`) !== tree) fail();
  if (git("rev-parse", `${record.predecessor.candidateSha}^{tree}`) !== record.predecessor.candidateTree) fail();
  return {
    classification: "READ_ONLY_NONCAPTURING_CUSTODY_CHECKOUT_PROBE",
    status: "PASS",
    baseSha,
    candidateSha,
    candidateHistory: "COMPLETE",
    frozenReferenceSha: record.frozenReferenceSha,
    predecessorLineage: "PASS",
    recordId: record.id,
    consumerReservations: 0,
    captures: 0,
    productReviews: 0,
    mainlineDecision: "NONE",
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, values) => {
      if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
      return pairs;
    }, []),
  );
  console.log(
    JSON.stringify(
      checkoutProbe({ root: path.resolve(args.workspace), baseSha: args.base, candidateSha: args.candidate }),
    ),
  );
}
