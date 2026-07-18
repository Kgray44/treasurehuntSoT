import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "node_modules", "@rive-app", "webgl2");
const targetRoot = path.join(root, "public", "runtimes");
const files = [
  { source: "rive.wasm", target: "rive.wasm" },
  { source: "rive_fallback.wasm", target: "rive-fallback.wasm" },
];

await mkdir(targetRoot, { recursive: true });
const artifacts = [];
for (const file of files) {
  const source = path.join(sourceRoot, file.source);
  const target = path.join(targetRoot, file.target);
  await copyFile(source, target);
  const bytes = await readFile(target);
  if (bytes.length < 4 || bytes.subarray(0, 4).toString("hex") !== "0061736d") {
    throw new Error(`${file.source} is not a WebAssembly binary.`);
  }
  artifacts.push({
    path: `/runtimes/${file.target}`,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

const packageMetadata = JSON.parse(await readFile(path.join(sourceRoot, "package.json"), "utf8"));
const manifest = {
  schemaVersion: 1,
  sourcePackage: packageMetadata.name,
  sourceVersion: packageMetadata.version,
  localOnly: true,
  artifacts,
};
await writeFile(path.join(targetRoot, "rive-runtime.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(manifest)}\n`);
