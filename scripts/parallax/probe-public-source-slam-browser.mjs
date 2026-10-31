import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const { chromium } = createRequire(path.join(process.cwd(), "package.json"))("playwright");
const args = process.argv.slice(2);
const argument = (name) => {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) throw new Error("Required argument: " + name);
  return path.resolve(args[index + 1]);
};
const directory = argument("--dist"),
  output = argument("--output"),
  wasm = fs.readFileSync(path.join(directory, "slam_wasm.wasm"));
const wasmSha256 = createHash("sha256").update(wasm).digest("hex");
const original = fs.readFileSync(new URL("./probe-public-source-slam.mjs", import.meta.url), "utf8");
const marker = "const width = 320,";
if (!original.includes(marker))
  throw new Error("Portable probe boundary changed; review the existing scenario harness.");
// Reuse the exact existing synthetic frames and admission checks; do not create a disconnected product AR scene.
const core = original
  .slice(original.indexOf(marker))
  .replace('sha = createHash("sha256").update(wasm).digest("hex"),', "sha = wasmSha256,");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ path: path.join(directory, "slam_wasm.js") });
  const started = performance.now();
  const records = await page.evaluate(
    async ({ core, bytes, wasmSha256 }) => {
      const records = [];
      const fs = {
        mkdirSync() {},
        writeFileSync(file, text) {
          records.push({ file: path.basename(file), data: JSON.parse(text) });
        },
      };
      const path = { join: (...parts) => parts.join("/"), basename: (file) => file.split("/").at(-1) };
      const exported = { exports: globalThis.createARModule };
      if (typeof exported.exports !== "function")
        throw new Error("Public source module factory unavailable in browser");
      const wasm = Uint8Array.from(bytes),
        outputRoot = "browser-slam";
      const run = new (Object.getPrototypeOf(async function () {}).constructor)(
        "fs",
        "path",
        "exported",
        "wasm",
        "outputRoot",
        "wasmSha256",
        core,
      );
      await run(fs, path, exported, wasm, outputRoot, wasmSha256);
      return records;
    },
    { core, bytes: Array.from(wasm), wasmSha256 },
  );
  const summary = records.find((record) => record.file === "summary.json")?.data;
  if (!summary || summary.summaries.length !== 9) throw new Error("Incomplete browser sequence coverage");
  fs.mkdirSync(output, { recursive: true });
  for (const record of records)
    fs.writeFileSync(path.join(output, record.file), JSON.stringify(record.data, null, 2) + "\n");
  const report = {
    documentClassification: "engineering-evidence",
    runtime: "ACTUAL_HEADLESS_CHROMIUM_WEBASSEMBLY",
    browserVersion: browser.version(),
    wasmSha256,
    elapsedMs: performance.now() - started,
    physicalAcceptance: false,
    cameraTested: false,
    motionSensorTested: false,
    licenseAdoption: false,
    truthOrientationProvided: true,
    truthTranslationProvided: false,
    truthDepthProvided: false,
    ...summary,
  };
  fs.writeFileSync(path.join(output, "browser-summary.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      output,
      wasmSha256,
      browserVersion: report.browserVersion,
      scenarios: summary.summaries.length,
      elapsedMs: report.elapsedMs,
    }),
  );
} finally {
  await browser.close();
}
