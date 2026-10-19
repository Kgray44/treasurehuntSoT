// Source-only reconciliation. Declarations do not establish rendered acceptance.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  affectedConsumers,
  sourceSnapshot,
  revisionJson,
  planProductExperience,
} from "../../scripts/sounding-line/product-experience.mjs";

const root = process.cwd();
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
const base = git("rev-parse", process.argv[2] ?? "origin/main");
const candidate = git("rev-parse", process.argv[3] ?? "HEAD");
const output = process.argv[4] ?? "artifacts/sextant-phase4/reconciliation.json";
const changed = git("diff", "--name-only", `${base}...${candidate}`).split("\n").filter(Boolean);
const candidateSnapshot = sourceSnapshot(root, candidate);
const candidatePaths = new Set(candidateSnapshot.entries.map((e) => e.path));
const consumers = affectedConsumers(changed, [sourceSnapshot(root, base), candidateSnapshot]);
const historical = revisionJson(
  root,
  candidate,
  "Development_Docs/Engineering/Sextant/phase4-shared-consumer-design-r1.json",
);
const contracts = revisionJson(root, candidate, "testing/contracts.json").contracts.filter((c) => c.experience);
// Match the authority's literal path-prefix semantics (not glob patterns).
const matches = (file, prefix) => file === prefix || file.startsWith(prefix.endsWith("/") ? prefix : prefix + "/");
const declarations = (file) =>
  contracts.filter((c) => c.experience.sourcePaths.some((p) => matches(file, p))).map((c) => c.id);
const surfaces = consumers.surfaces.map((path) => ({ path, contracts: declarations(path) }));
let planner;
try {
  const plan = planProductExperience({ root, baseSha: base, candidateSha: candidate, changedPaths: changed });
  planner = { status: "PASS_DECLARATIONS_ONLY", contracts: plan.contractIds };
} catch (error) {
  planner = { status: "BLOCKED", reason: error.message };
}
const receipt = {
  schemaVersion: 1,
  classification: "ENGINEERING_EVIDENCE_SOURCE_ONLY_NOT_ACCEPTANCE",
  generatedAt: new Date().toISOString(),
  baseSha: base,
  candidateSha: candidate,
  candidateTree: git("rev-parse", `${candidate}^{tree}`),
  current: {
    affectedSurfaces: surfaces.length,
    unregistered: surfaces.filter((s) => !s.contracts.length).length,
    surfaces,
  },
  historical: {
    recordedObligations: historical.uncoveredCount,
    uniquePaths: new Set(historical.families.flatMap((f) => f.sourcePaths)).size,
    families: historical.families.map((f) => ({
      id: f.id,
      owner: f.domainOwner,
      paths: f.sourcePaths.map((path) => ({
        path,
        exists: candidatePaths.has(path),
        currentlyAffected: consumers.surfaces.includes(path),
        contracts: declarations(path),
      })),
      supportGaps: f.supportGaps,
    })),
  },
  planner,
  acceptance: "NOT_GRANTED",
  historicalReceipts: "UNCHANGED_ORIGINAL_SOURCE_IDENTITIES",
};
mkdirSync(output.substring(0, Math.max(output.lastIndexOf("/"), output.lastIndexOf("\\"))), { recursive: true });
writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
process.stdout.write(
  JSON.stringify({
    output,
    base,
    candidate,
    affected: surfaces.length,
    unregistered: receipt.current.unregistered,
    historicalPaths: receipt.historical.uniquePaths,
    planner: planner.status,
  }) + "\n",
);
