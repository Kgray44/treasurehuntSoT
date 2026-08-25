import { compareSemanticSnapshots } from "../../src/tideglass/comparison";
import { canonicalizePublishedSnapshot } from "../../src/tideglass/semantic";
import { anchor } from "./fixtures";

const encoded = process.argv[2];
if (!encoded) throw new Error("TIDEGLASS_CROSS_PROCESS_INPUT_REQUIRED");
const input = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { source: unknown; target: unknown };
const source = canonicalizePublishedSnapshot(JSON.stringify(input.source), anchor("edition-a", "source-checksum"));
const target = canonicalizePublishedSnapshot(JSON.stringify(input.target), anchor("edition-b", "target-checksum"));
if (!source.ok || !target.ok) throw new Error("TIDEGLASS_CROSS_PROCESS_NORMALIZATION_FAILED");
process.stdout.write(`${JSON.stringify(compareSemanticSnapshots(source.value, target.value))}\n`);
