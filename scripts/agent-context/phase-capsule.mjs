import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildAcceptedCapsule, buildProvisionalCapsule, canonicalJson, validateCapsule } from "./logbook.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

const inputPath = option("--input");
const outputPath = option("--out");
if (!inputPath || !outputPath) throw new Error("USAGE: phase-capsule.mjs --input <json> --out <json>");

const input = JSON.parse(readFileSync(inputPath, "utf8"));
const capsule = input.state === "PROVISIONAL" ? buildProvisionalCapsule(input) : buildAcceptedCapsule(input);
const validation = validateCapsule(capsule);
if (!validation.valid) throw new Error(`INVALID_CAPSULE:${validation.errors.join("|")}`);
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${canonicalJson(capsule)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ output: outputPath, state: capsule.state, digest: capsule.integrity.semanticDigest })}\n`);
