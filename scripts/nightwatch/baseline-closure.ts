import { readFile } from "node:fs/promises";
import process from "node:process";
import {
  BosunAutoZeroExecutor,
  createRepositoryAutoZeroActions,
  planBaselineAutoZeroClosure,
  type BaselineCertificationFailure,
} from "../../src/nightwatch/bosun";

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const receiptPath = option("--receipt");
if (!receiptPath) throw new Error("BOSUN_BASELINE_RECEIPT_REQUIRED");
const main = async () => {
  const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as { failures?: BaselineCertificationFailure[] };
  const plan = planBaselineAutoZeroClosure(receipt.failures ?? []);
  if (!args.includes("--execute") || plan.status !== "READY") {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }
  const actions = createRepositoryAutoZeroActions(process.cwd(), {
    featureCatalogCommand: [process.execPath, "node_modules/tsx/dist/cli.mjs", "scripts/features/build-feature-catalog.ts"],
  });
  const lookup = {
    "p34-retirement-ledger": actions.p34RetirementLedger,
    "active-test-registry": actions.activeTestRegistry,
    "document-index": actions.documentIndex,
    "feature-catalog": actions.featureCatalog,
    "deepwater-policy": actions.deepwaterPolicy,
  } as const;
  const expected = Object.fromEntries(Object.entries(lookup).map(([id, action]) => [action.id, action.allowedPaths]));
  const result = await new BosunAutoZeroExecutor().executeCompound(
    plan.actionIds.map((id) => lookup[id as keyof typeof lookup]),
    expected,
  );
  process.stdout.write(`${JSON.stringify({ plan, result }, null, 2)}\n`);
};
void main();
