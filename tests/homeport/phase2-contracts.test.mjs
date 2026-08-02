import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const generator = path.join(root, "scripts", "homeport", "generate-phase2-contracts.ts");
const filenames = [
  "Project_Homeport_Phase_2_Shell_Mode_Registry.json",
  "Project_Homeport_Phase_2_Navigation_Projection_Contract.json",
  "Project_Homeport_Phase_2_Desktop_Mobile_Parity_Matrix.csv",
  "Project_Homeport_Phase_2_Contextual_Exit_Matrix.csv",
];
const digest = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

function generate(outputRoot, ...args) {
  return execFileSync(process.execPath, [tsxCli, generator, ...args], {
    cwd: root,
    env: { ...process.env, HOMEPORT_PHASE2_OUTPUT_ROOT: outputRoot },
    encoding: "utf8",
  });
}

test("homeport.navigation.idempotent-artifact-update produces the same ordered artifacts on repeated runs", () => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "homeport-phase2-contracts-"));
  try {
    assert.match(generate(temporaryRoot), /PHASE_2_CONTRACTS_GENERATED/u);
    const first = Object.fromEntries(filenames.map((file) => [file, digest(path.join(temporaryRoot, file))]));
    assert.match(generate(temporaryRoot), /PHASE_2_CONTRACTS_GENERATED/u);
    const second = Object.fromEntries(filenames.map((file) => [file, digest(path.join(temporaryRoot, file))]));
    assert.deepEqual(second, first);
    assert.match(generate(temporaryRoot, "--check"), /PHASE_2_CONTRACTS_IDEMPOTENT/u);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("homeport.shell.mode-classification generates one mode for every current page without an API record", () => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "homeport-phase2-modes-"));
  try {
    generate(temporaryRoot);
    const registry = JSON.parse(
      readFileSync(path.join(temporaryRoot, "Project_Homeport_Phase_2_Shell_Mode_Registry.json"), "utf8"),
    );
    assert.equal(registry.pageCount, 69);
    assert.equal(registry.records.length, 69);
    assert.equal(new Set(registry.records.map((record) => record.routeId)).size, 69);
    assert.equal(
      registry.records.some((record) => record.routePattern.startsWith("/api")),
      false,
    );
    assert.deepEqual(
      new Set(registry.validModes),
      new Set([
        "GATEWAY_STANDARD",
        "PUBLIC_STANDARD",
        "WORKSPACE_STANDARD",
        "COMPACT",
        "IMMERSIVE",
        "AUTHENTICATION",
        "TOKENIZED",
        "DEVELOPMENT",
      ]),
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
