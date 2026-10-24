import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const reference = new URL(
  "../../Development_Docs/Projects/Project_Parallax/reference/browser-slam-evaluation/",
  import.meta.url,
);

// The historical camera-prototype manifest pins CRLF distribution bytes.
// Git's text normalization must not silently change the served artifact identity.
export async function preparePublicSourceTrackerNotices(outputFile) {
  const manifest = JSON.parse(await readFile(new URL("public-source-camera-prototype.json", reference), "utf8"));
  const derivation = manifest.noticesDerivation;
  const source = await readFile(new URL(derivation.sourceFile, reference), "utf8");
  const canonical = Buffer.from(source.replace(/\r\n/g, "\n"), "utf8");
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  if (canonical.length !== derivation.canonicalLfBytes || digest(canonical) !== derivation.canonicalLfSha256)
    throw new Error("Tracker notice source does not match its pinned canonical identity.");
  const artifact = Buffer.from(canonical.toString("utf8").replace(/\n/g, "\r\n"), "utf8");
  const expected = manifest.assets.find((asset) => asset.file === "public-source-slam.NOTICES.txt");
  if (!expected || artifact.length !== expected.bytes || digest(artifact) !== expected.sha256)
    throw new Error("Derived tracker notices do not match the existing served-asset manifest.");
  // Never replace an existing local prototype artifact or alter an active runtime.
  await writeFile(outputFile, artifact, { flag: "wx" });
  return { file: resolve(outputFile), bytes: artifact.length, sha256: digest(artifact) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output-file")
    throw new Error("Usage: node scripts/parallax/prepare-public-source-tracker-notices.mjs --output-file <new-file>");
  console.log(JSON.stringify(await preparePublicSourceTrackerNotices(resolve(args[1]))));
}
