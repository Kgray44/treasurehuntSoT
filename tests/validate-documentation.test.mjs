import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { validate } from "../scripts/validate-documentation.mjs";

test("validator reports missing required structure", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ledgerlight-docs-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const failures = await validate(root);
  assert.ok(failures.some((failure) => failure.includes("missing required document")));
});

test("validator rejects forbidden user-guide language", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ledgerlight-docs-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "docs/user"), { recursive: true });
  await writeFile(
    path.join(root, "docs/user/example.md"),
    "---\ntitle: Example\naudience: user\nstatus: current\ncanonical_for: example\nlast_reviewed: 2026-07-27\n---\n\nCodex should continue.\n",
  );
  const failures = await validate(root);
  assert.ok(failures.some((failure) => failure.includes("restricted automation language")));
});

test("validator catches broken links, duplicate canonical topics, and orphan documents", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ledgerlight-docs-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "docs/user"), { recursive: true });
  const page = (title, canonical, body = "") =>
    `---\ntitle: ${title}\naudience: user\nstatus: current\ncanonical_for: ${canonical}\nlast_reviewed: 2026-07-27\n---\n\n${body}`;
  await writeFile(path.join(root, "docs/README.md"), page("Hub", "hub"));
  await writeFile(path.join(root, "docs/user/a.md"), page("A", "same-topic", "[missing](missing.md)"));
  await writeFile(path.join(root, "docs/user/b.md"), page("B", "same-topic"));
  const failures = await validate(root);
  assert.ok(failures.some((failure) => failure.includes("broken link")));
  assert.ok(failures.some((failure) => failure.includes("duplicate canonical_for")));
  assert.ok(failures.some((failure) => failure.includes("orphan current document")));
});

test("validator catches unindexed records, stale index paths, root files, and commit evidence", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ledgerlight-docs-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "Development_Docs"), { recursive: true });
  await mkdir(path.join(root, "docs/user"), { recursive: true });
  await writeFile(path.join(root, "NOTES.md"), "not allowed\n");
  await writeFile(path.join(root, "Development_Docs/evidence.md"), "evidence\n");
  await writeFile(
    path.join(root, "Development_Docs/document-index.json"),
    JSON.stringify({ records: [{ path: "Development_Docs/stale.md" }] }),
  );
  await writeFile(
    path.join(root, "docs/user/evidence.md"),
    "---\ntitle: Evidence\naudience: user\nstatus: current\ncanonical_for: evidence\nlast_reviewed: 2026-07-27\n---\n\n0123456789abcdef0123456789abcdef01234567\n",
  );
  const failures = await validate(root);
  assert.ok(failures.some((failure) => failure.includes("unapproved root")));
  assert.ok(failures.some((failure) => failure.includes("unindexed engineering record")));
  assert.ok(failures.some((failure) => failure.includes("stale index path")));
  assert.ok(failures.some((failure) => failure.includes("restricted automation language")));
});
