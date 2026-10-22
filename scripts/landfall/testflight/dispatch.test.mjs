import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderWorkflow, validateInputs } from "./dispatch.mjs";

const input = {
  candidate: "a".repeat(40),
  mode: "unsigned",
  origin: "https://192.168.0.18:8449",
  version: "0.1.0",
  build: "1",
};
test("transport pins exact source and keeps unsigned job outside credential environments", () => {
  const template = readFileSync(new URL("../../../.agents/ncl01-testflight-hosted.yml", import.meta.url), "utf8");
  const workflow = renderWorkflow(template, input);
  assert.match(workflow, /unsigned:\s+if: true/);
  assert.match(workflow, /upload:\s+if: false\s+environment: ncl01-testflight/);
  const unsigned = workflow.slice(workflow.indexOf("  unsigned:"), workflow.indexOf("  preflight:"));
  assert.ok(!unsigned.includes("secrets."));
  assert.ok(!unsigned.includes("environment:"));
  assert.match(workflow, /preflight:\s+if: false/);
  assert.equal((workflow.match(new RegExp(`ref: ${input.candidate}`, "g")) ?? []).length, 3);
  assert.ok(!workflow.includes("__CANDIDATE"));
});
test("unsafe origin shell syntax, HTTP, arbitrary paths and invalid build inputs fail before publication", () => {
  for (const origin of [
    "http://192.168.0.18:8449",
    "https://a'bad",
    "https://example.com/path",
    "https://user:pass@example.com",
    "https://example.com/#fragment",
  ]) {
    assert.throws(() => validateInputs({ ...input, origin }));
  }
  for (const build of ["0", "10000", "1;echo", "1.100", "1.2.3.4"])
    assert.throws(() => validateInputs({ ...input, build }));
});
test("processing can resume without reuploading an already accepted build", () => {
  const template = readFileSync(new URL("../../../.agents/ncl01-testflight-hosted.yml", import.meta.url), "utf8");
  const workflow = renderWorkflow(template, { ...input, mode: "observe", build: "1.2" });
  assert.match(workflow, /unsigned:\s+if: false/);
  assert.match(workflow, /upload:\s+if: true/);
  assert.match(workflow, /--mode observe/);
});

test("preflight alone receives governed credentials and uploads only the sanitized receipt", () => {
  const template = readFileSync(new URL("../../../.agents/ncl01-testflight-hosted.yml", import.meta.url), "utf8");
  const workflow = renderWorkflow(template, { ...input, mode: "preflight", build: "7" });
  assert.match(workflow, /unsigned:\s+if: false/);
  assert.match(workflow, /upload:\s+if: false/);
  const preflight = workflow.slice(workflow.indexOf("  preflight:"), workflow.indexOf("  upload:"));
  assert.match(preflight, /if: true\s+environment: ncl01-testflight/);
  assert.match(preflight, /--mode preflight --candidate a{40}/);
  assert.match(preflight, /if: always\(\)[\s\S]*--cleanup-owned/);
  assert.match(preflight, /path: artifacts\/ncl01-testflight\/public\/receipt\.json/);
  assert.equal((preflight.match(/secrets\.NCL01_/g) ?? []).length, 4);
  assert.equal((preflight.match(/vars\.NCL01_/g) ?? []).length, 4);
  assert.doesNotMatch(preflight, /xcodegen|brew |xcodebuild|altool|\.ipa/);
});

test("every accepted mode enables exactly one job and arbitrary modes fail closed", () => {
  const template = readFileSync(new URL("../../../.agents/ncl01-testflight-hosted.yml", import.meta.url), "utf8");
  for (const mode of ["unsigned", "upload", "observe", "preflight"]) {
    const workflow = renderWorkflow(template, { ...input, mode });
    assert.equal((workflow.match(/^    if: true$/gm) ?? []).length, 1);
    assert.ok(!/__[A-Z_]+__/.test(workflow));
  }
  for (const mode of ["status", "preflight;upload", "", undefined]) {
    assert.throws(() => validateInputs({ ...input, mode }), /NCL01_MODE_INVALID/);
  }
});
