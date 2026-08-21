import process from "node:process";
import { BosunAutoZeroExecutor, createRepositoryAutoZeroActions } from "../../src/nightwatch/bosun";

const actionName = process.argv[2];
const actions = createRepositoryAutoZeroActions(process.cwd(), {
  featureCatalogCommand: process.env.BOSUN_FEATURE_CATALOG_COMMAND?.split(" ").filter(Boolean),
});
const selected =
  actionName === "active-test-registry"
    ? actions.activeTestRegistry
    : actionName === "document-index"
      ? actions.documentIndex
      : actionName === "feature-catalog"
        ? actions.featureCatalog
        : null;

if (!selected) throw new Error("USAGE: bosun-canary <active-test-registry|document-index|feature-catalog>");

const expectedPaths = (process.env.BOSUN_EXPECTED_PATHS ?? "")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);

void new BosunAutoZeroExecutor()
  .execute(selected, expectedPaths)
  .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`));
