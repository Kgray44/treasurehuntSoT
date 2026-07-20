import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatLanguageViolations, scanProductionLanguage } from "../src/language/forbidden-language";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

scanProductionLanguage(repositoryRoot)
  .then((violations) => {
    if (violations.length === 0) {
      console.log("Voyagewright product-language validation passed.");
      return;
    }
    console.error(formatLanguageViolations(violations));
    console.error(`Found ${violations.length} prohibited product-language occurrence(s).`);
    process.exitCode = 1;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  });
