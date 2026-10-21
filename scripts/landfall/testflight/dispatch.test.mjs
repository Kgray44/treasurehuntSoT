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
test("transport pins exact source and exposes signing environment only in disabled upload job", () => {
  const template = readFileSync(new URL("../../../.agents/ncl01-testflight-hosted.yml", import.meta.url), "utf8");
  const workflow = renderWorkflow(template, input);
  assert.match(workflow, /unsigned:\s+if: true/);
  assert.match(workflow, /upload:\s+if: false\s+environment: ncl01-testflight/);
  assert.ok(!workflow.slice(0, workflow.indexOf("  upload:")).includes("secrets."));
  assert.equal((workflow.match(new RegExp(`ref: ${input.candidate}`, "g")) ?? []).length, 2);
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
