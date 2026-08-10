import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { drydockRuleCatalog } from "@/drydock/rules";

const target = resolve(process.cwd(), "Development_Docs/Projects/Project Drydock/Project_Drydock_Phase_2_Rule_Catalog.json");
const document = {
  schemaVersion: 1,
  catalogVersion: 1,
  status: "ACTIVE_IMPLEMENTATION_SUBSET",
  authority: "src/drydock/rules.ts",
  scope: "Executable Drydock rules currently emitted by implemented Phase 1 and Phase 2 validation; this record does not claim complete Phase 2 coverage.",
  rules: [...drydockRuleCatalog]
    .sort((left, right) => left.code.localeCompare(right.code, "en"))
    .map(({ code, version, category, defaultSeverity, waiverPolicy, applicability, repairClassification, compatibilityPolicy }) => ({
      code, version, category, defaultSeverity, waiverPolicy, applicability, repairClassification, compatibilityPolicy,
    })),
};
const rendered = `${JSON.stringify(document, null, 2)}\n`;

async function main() {
  if (process.argv.includes("--write")) {
    await writeFile(target, rendered, "utf8");
    process.stdout.write(`DRYDOCK_RULE_CATALOG_WRITTEN ${document.rules.length}\n`);
  } else {
    const existing = await readFile(target, "utf8");
    if (existing !== rendered) throw new Error("DRYDOCK_RULE_CATALOG_DRIFT");
    process.stdout.write(`DRYDOCK_RULE_CATALOG_CURRENT ${document.rules.length}\n`);
  }
}

void main();
