import fs from "node:fs";
import path from "node:path";

const [, , sourcePath, outputPath, contractName] = process.argv;

if (!sourcePath || !outputPath || contractName !== "finale-mechanism") {
  throw new Error("Usage: node repair-rive-contract-names.mjs <source> <output> finale-mechanism");
}

/**
 * The current Rive beta editor can create legacy inputs but does not expose a rename control
 * for newly-created legacy inputs or the state-machine label. This narrowly rewrites only those
 * serialized display strings after native authoring. It never changes component, input-type,
 * transition, animation, or artboard records.
 */
const replacements = new Map([
  ["State Machine 1", "FinaleMechanismSM"],
  ["Number 1", "stage"],
  ["Number 2", "overallProgress"],
  ["Number 3", "activeRequirement"],
  ["Number 4", "requirementProgress"],
  ["Boolean 1", "isReady"],
  ["Boolean 2", "reducedMotion"],
  ["Trigger 1", "tease"],
  ["Trigger 2", "activateRequirement"],
  ["Trigger 3", "unlock"],
  ["Trigger 4", "complete"],
  ["Trigger 5", "showHistorical"],
  ["Trigger 6", "reset"],
]);

let data = fs.readFileSync(sourcePath);

for (const [before, after] of replacements) {
  const source = Buffer.from(before, "utf8");
  const target = Buffer.from(after, "utf8");
  const offset = data.indexOf(source);
  if (offset < 1 || data.indexOf(source, offset + 1) !== -1) {
    throw new Error(`${before}: expected exactly one serialized name`);
  }
  if (data[offset - 1] !== source.length || target.length > 0x7f) {
    throw new Error(`${before}: unexpected Rive string encoding`);
  }
  data[offset - 1] = target.length;
  data = Buffer.concat([data.subarray(0, offset), target, data.subarray(offset + source.length)]);
}

if (path.extname(sourcePath).toLowerCase() === ".riv" && !data.subarray(0, 4).equals(Buffer.from("RIVE"))) {
  throw new Error("runtime export does not have the RIVE header");
}
for (const expected of replacements.values()) {
  if (!data.includes(Buffer.from(expected, "utf8"))) throw new Error(`missing patched name ${expected}`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, data);
console.log(`Wrote ${outputPath} (${data.length} bytes) with ${replacements.size} frozen contract names.`);
