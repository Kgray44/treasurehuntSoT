import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { generateDocumentIndex } from "../../../scripts/generate-document-index.mjs";

const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const migrationMatrix = "Development_Docs/Project_Ledgerlight_Documentation_Migration_Matrix.csv";

async function write(root, relativePath, contents) {
  const destination = path.join(root, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, contents);
}

async function commitAsProtectedMain(root, message) {
  git(root, ["add", "--all"]);
  git(root, ["commit", "-m", message]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

async function matrix(root) {
  return readFile(path.join(root, migrationMatrix), "utf8");
}

test("Ledgerlight inventory has a non-recursive generated-state-closure boundary and retains real migrations", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ledgerlight-fixed-point-"));
  try {
    await write(root, "Development_Docs/Programs/Example/Baseline_Record.md", "# Baseline record\n");
    git(root, ["init"]);
    git(root, ["config", "user.name", "Ledgerlight test"]);
    git(root, ["config", "user.email", "ledgerlight-test@example.invalid"]);
    git(root, ["config", "core.autocrlf", "false"]);
    git(root, ["add", "--all"]);
    git(root, ["commit", "-m", "initial documentation"]);
    git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

    await generateDocumentIndex({ root });
    await commitAsProtectedMain(root, "baseline generated state");

    await write(
      root,
      "Development_Docs/Completion_Receipts/Ordinary_Completion_Receipt.md",
      "# Ordinary completion receipt\n",
    );
    await write(root, "Development_Docs/Governing/Eligible_Amendment.md", "# Eligible governing amendment\n");
    await generateDocumentIndex({ root });
    assert.match(await matrix(root), /Ordinary_Completion_Receipt\.md/u);
    assert.match(await matrix(root), /Eligible_Amendment\.md/u);
    await commitAsProtectedMain(root, "eligible documentation migration");
    const beforeClosure = await matrix(root);

    await write(
      root,
      "Development_Docs/Programs/Example/Generated_State_Closure.md",
      [
        "---",
        "title: Generated state closure",
        "audience: engineering",
        "status: current",
        "canonical_for: generated-state-closure",
        "ledgerlight_inventory_role: generated-state-closure",
        "last_reviewed: 2026-08-22",
        "---",
        "",
        "# Generated state closure",
      ].join("\n"),
    );
    await generateDocumentIndex({ root });
    assert.equal(await matrix(root), beforeClosure);
    assert.match(
      await readFile(path.join(root, "Development_Docs/document-index.json"), "utf8"),
      /Generated_State_Closure\.md/u,
    );
    assert.doesNotMatch(await matrix(root), /Generated_State_Closure\.md/u);
    await commitAsProtectedMain(root, "record generated state closure metadata");

    for (let pass = 1; pass <= 3; pass += 1) {
      await generateDocumentIndex({ root });
      assert.equal(git(root, ["status", "--porcelain"]), "", `generator pass ${pass} must be a fixed point`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
