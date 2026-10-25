// Transport only: the protected PR776 selector still validates every review and source binding.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PR776_CONTROLLER, PR776_RECORD_PATH } from "./experience-pr776-controller-reconciliation.mjs";

const E = path.posix.dirname(PR776_RECORD_PATH);
const C = "Development_Docs/Testing/Product_Experience/candidate-review.json";
const INDEX = "Development_Docs/document-index.json";
const MATRIX = "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv";
const CAPTURE_CANDIDATE = "f265f062767d40618df9152aa8900eaf17bfa92d";
// The registration suite reads both historical workflow versions after transport locks.
const workflowReaders = ["e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab", "bfea71aad2c7fafdec0590ba1ac09ee3399e08d5"].map(
  (revision) => ({ revision, path: ".github/workflows/sounding-line-ordinary.yml" }),
);
const additions = [
  "accepted-canonical.original.json",
  "independent-review.original.json",
  "captured-plan.original.json",
  "public-files-941.original.json",
  "controller-reconciliation.json",
].map((file) => `${E}/${file}`);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const stable = (value) =>
  JSON.stringify(value, (_, item) =>
    item && !Array.isArray(item) && typeof item === "object"
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
const same = (a, b) => stable(a) === stable(b);
const need = (value, code) => {
  if (!value) throw new Error(`SOUNDING_LINE_PR776_CHECKOUT_${code}`);
};
const tree = (text) =>
  new Map(
    text
      .split("\0")
      .filter(Boolean)
      .map((row) => {
        const [metadata, file] = row.split("\t");
        return [file, metadata];
      }),
  );

export function validatePR776CheckoutInventories(inventory, original, current) {
  need(inventory.length === 941 && new Set(inventory.map((row) => row.path)).size === 941, "INVENTORY_CHANGED");
  for (const row of inventory) {
    const expected = `100644 blob ${row.blob}`;
    need(original.get(row.path) === expected, "ORIGINAL_EVIDENCE_CHANGED");
    if (![C, INDEX, MATRIX].includes(row.path)) need(current.get(row.path) === expected, "IMMUTABLE_EVIDENCE_CHANGED");
  }
}

export function validatePR776CheckoutCanonical(original, published) {
  need(digest(original) === PR776_CONTROLLER.canonicalSha256, "CANONICAL_ORIGINAL_CHANGED");
  const value = JSON.parse(published);
  const id = value.reviewArtifactId;
  need(id === undefined || (Number.isSafeInteger(id) && id > 0), "REVIEW_ID_INVALID");
  delete value.reviewArtifactId;
  need(same(value, JSON.parse(original)), "CANONICAL_CHANGED");
}

export function validatePR776CheckoutIndexes(oldIndex, baseIndex, currentIndex, oldCSV, currentCSV) {
  const byPath = new Map(currentIndex.records.map((row) => [row.path, row]));
  const oldPaths = new Set(oldIndex.records.map((row) => row.path));
  need(
    byPath.size === currentIndex.records.length &&
      currentIndex.records.length === oldIndex.records.length + additions.length &&
      oldIndex.records.every((row) => same(row, byPath.get(row.path))) &&
      same(
        currentIndex.records
          .filter((row) => !oldPaths.has(row.path))
          .map((row) => row.path)
          .sort(),
        [...additions].sort(),
      ) &&
      additions.every((file) =>
        same(
          byPath.get(file),
          baseIndex.records.find((row) => row.path === file),
        ),
      ),
    "INDEX_CHANGED",
  );
  const lines = (text) => text.trimEnd().split(/\r?\n/u);
  const oldLines = lines(oldCSV),
    currentLines = lines(currentCSV),
    currentSet = new Set(currentLines),
    oldSet = new Set(oldLines);
  const added = currentLines.filter((line) => !oldSet.has(line));
  need(
    currentSet.size === currentLines.length &&
      oldLines.every((line) => currentSet.has(line)) &&
      added.length === additions.length &&
      same(added.map((line) => /^"([^"]+)"/u.exec(line)?.[1]).sort(), [...additions].sort()),
    "MATRIX_CHANGED",
  );
}

export function pr776CheckoutProfile({ authorityRoot, baseSha, candidateSha, env = process.env }) {
  need(/^[a-f0-9]{40}$/u.test(baseSha ?? "") && /^[a-f0-9]{40}$/u.test(candidateSha ?? ""), "INVALID_IDENTITY");
  need(
    env.GITHUB_REPOSITORY === "Kgray44/treasurehuntSoT" &&
      env.GITHUB_SHA === baseSha &&
      env.GITHUB_REF === "refs/heads/main",
    "UNTRUSTED_BASE",
  );
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  const pull = event.pull_request;
  need(
    env.GITHUB_EVENT_NAME === "workflow_dispatch"
      ? event.inputs?.pr_number === "776" &&
          event.inputs?.base_sha === baseSha &&
          event.inputs?.candidate_sha === candidateSha
      : env.GITHUB_EVENT_NAME === "pull_request_target" &&
          pull?.number === 776 &&
          pull?.base?.sha === baseSha &&
          pull?.base?.repo?.full_name === env.GITHUB_REPOSITORY &&
          pull?.head?.repo?.full_name === env.GITHUB_REPOSITORY &&
          pull?.head?.sha === candidateSha,
    "UNTRUSTED_EVENT",
  );
  const read = (file) => readFileSync(path.join(authorityRoot, file));
  const record = JSON.parse(read(PR776_RECORD_PATH));
  need(
    record.status === "ACTIVE" &&
      record.prNumber === 776 &&
      record.additionalIndependentPasses === 0 &&
      same(record.originalIdentity, PR776_CONTROLLER),
    "PROTECTED_RECORD_CHANGED",
  );
  const inventoryBytes = read(`${E}/public-files-941.original.json`);
  need(digest(inventoryBytes) === PR776_CONTROLLER.inventorySha256, "INVENTORY_CHANGED");
  const inventory = JSON.parse(inventoryBytes);
  const historical = [
    PR776_CONTROLLER.ancestor,
    PR776_CONTROLLER.oldBase,
    CAPTURE_CANDIDATE,
    ...workflowReaders.map((reader) => reader.revision),
  ];
  return {
    roots: historical,
    readerRevisions: historical,
    readerObjects: [],
    readerPaths: [
      ...[INDEX, MATRIX].map((file) => ({ revision: PR776_CONTROLLER.ancestor, path: file })),
      ...workflowReaders,
    ],
    budgetMs: 600000,
    stallBudgetMs: 600000,
    preservation: async ({ command }) => {
      await command(["merge-base", "--is-ancestor", PR776_CONTROLLER.ancestor, candidateSha]);
      need(
        (await command(["show", `${baseSha}:${PR776_RECORD_PATH}`])) === read(PR776_RECORD_PATH).toString().trim(),
        "RECORD_CHANGED",
      );
      const original = tree(await command(["ls-tree", "-rz", PR776_CONTROLLER.ancestor]));
      const current = tree(await command(["ls-tree", "-rz", candidateSha]));
      validatePR776CheckoutInventories(inventory, original, current);
      validatePR776CheckoutCanonical(
        read(`${E}/accepted-canonical.original.json`),
        await command(["show", `${candidateSha}:${C}`]),
      );
      const at = (revision, file) => command(["show", `${revision}:${file}`]);
      validatePR776CheckoutIndexes(
        JSON.parse(await at(PR776_CONTROLLER.ancestor, INDEX)),
        JSON.parse(await at(baseSha, INDEX)),
        JSON.parse(await at(candidateSha, INDEX)),
        await at(PR776_CONTROLLER.ancestor, MATRIX),
        await at(candidateSha, MATRIX),
      );
      return { preservationPins: 941, historicalManifestPinsRetained: [C, INDEX, MATRIX] };
    },
  };
}
