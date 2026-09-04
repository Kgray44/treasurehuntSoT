import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const userFacingSourceRoot = resolve(process.cwd(), "src");
const sourceExtensions = new Set([".ts", ".tsx"]);
const commonMojibakeSequences = ["Â·", "Ã—", "â€”", "â€¦", "âœ¦", "â—‡", "�"];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf("."))) &&
      !/\.test\.[cm]?[jt]sx?$/u.test(entry.name)
      ? [path]
      : [];
  });
}

export function findUserFacingTextIntegrityViolations(root = userFacingSourceRoot) {
  return sourceFiles(root).flatMap((path) => {
    const contents = readFileSync(path, "utf8");
    return commonMojibakeSequences.flatMap((sequence) => {
      const locations = [];
      let offset = contents.indexOf(sequence);
      while (offset !== -1) {
        locations.push({
          path: relative(process.cwd(), path).replaceAll("\\", "/"),
          line: contents.slice(0, offset).split("\n").length,
          sequence,
        });
        offset = contents.indexOf(sequence, offset + sequence.length);
      }
      return locations;
    });
  });
}

function report() {
  const violations = findUserFacingTextIntegrityViolations();
  if (!violations.length) {
    console.log("BRIGHTWORK_TEXT_INTEGRITY_OK");
    return;
  }
  for (const violation of violations)
    console.error(
      `${violation.path}:${violation.line} contains prohibited mojibake sequence ${JSON.stringify(violation.sequence)}`,
    );
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) report();
