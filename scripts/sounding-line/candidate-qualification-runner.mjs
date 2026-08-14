/* Executes trusted qualification controls against a separately checked-out candidate subject. */
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { finalizeTrustedCandidatePlan } from "./candidate-qualification.mjs";

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1] ?? null;
const planPath = value("--plan");
const candidateRoot = path.resolve(value("--candidate-root") ?? "");
if (!planPath || !candidateRoot) throw new Error("CANDIDATE_RUNNER_ARGUMENTS_REQUIRED");
const plan = JSON.parse(await readFile(planPath, "utf8"));
if (path.resolve(plan.subjectCandidate.root) !== candidateRoot) throw new Error("CANDIDATE_ROOT_BINDING_INVALID");
const git = async (...gitArgs) => (await execFileAsync("git", ["-C", candidateRoot, ...gitArgs])).stdout.trim();
if ((await git("rev-parse", "HEAD")) !== plan.subjectCandidate.headSha)
  throw new Error("CANDIDATE_HEAD_BINDING_INVALID");
if ((await git("rev-parse", "HEAD^{tree}")) !== plan.subjectCandidate.treeSha)
  throw new Error("CANDIDATE_TREE_BINDING_INVALID");

const trustedRoot = path.resolve(plan.authoritySource.root);
const trustedScript = (...segments) => path.join(trustedRoot, "scripts", "sounding-line", ...segments);
const execute = async (obligationId) => {
  const validation = [
    trustedScript("test-registry.mjs"),
    trustedScript("validate-test-identities.mjs"),
    trustedScript("p34-retirement.mjs"),
  ];
  try {
    // The executable modules are selected from the authority checkout while
    // their process cwd is the candidate checkout. Candidate controls cannot
    // replace the planner, validator, or finalizer that judge their tree.
    if (["policy-static", "stable-test-registry", "p34-retirement"].includes(obligationId))
      for (const script of validation) await execFileAsync(process.execPath, [script], { cwd: candidateRoot });
    if (
      [
        "trusted-authority-isolation",
        "maintenance-classifier-adversarial",
        "planner-finalizer-binding",
        "trusted-finalizer",
      ].includes(obligationId)
    )
      await execFileAsync(
        process.execPath,
        ["--test", path.join(trustedRoot, "tests", "sounding-line", "v141-service-track.test.mjs")],
        {
          cwd: trustedRoot,
        },
      );
    return { obligationId, status: "PASSED" };
  } catch (error) {
    return { obligationId, status: "FAILED", detail: error.stderr?.toString().slice(-4000) ?? error.message };
  }
};
const receipts = await Promise.all(plan.obligations.map(execute));
const boundReceipts = receipts.map((receipt) => ({
  ...receipt,
  authoritySourceSha: plan.authoritySource.sha,
  authoritySourceTree: plan.authoritySource.tree,
  candidateHeadSha: plan.subjectCandidate.headSha,
  candidateTreeSha: plan.subjectCandidate.treeSha,
  qualifiedBaseSha: plan.subjectCandidate.qualifiedBaseSha,
}));
const result = finalizeTrustedCandidatePlan({ plan, receipts: boundReceipts });
const output = { plan, receipts: boundReceipts, finalization: result };
const out = value("--out");
if (out) await writeFile(out, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exitCode = new Set(["RELEASE_GO", "MAINTENANCE_GO"]).has(result.decision) ? 0 : 1;
