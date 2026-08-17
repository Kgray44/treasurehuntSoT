import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DESIGN_TOKENS,
  PRIVATE_METADATA_FIELDS,
  assertWeekId,
  inside,
  periodForWeek,
  validatePublicMetadata,
  validateRecord,
} from "../../scripts/confluence/core.mjs";

test("uses natural America/New_York ISO weeks", () => {
  assert.deepEqual(periodForWeek("2026-W34"), {
    weekId: "2026-W34",
    start: "2026-08-17T00:00:00-04:00",
    end: "2026-08-24T00:00:00-04:00",
    timezone: "America/New_York",
  });
  assert.throws(() => assertWeekId("2026-week-34"), /CONFLUENCE_INVALID_WEEK_ID/);
});

test("rejects archive path traversal and incomplete evidence", () => {
  assert.equal(inside("C:\\archive", "C:\\archive\\engineering\\weekly"), true);
  assert.equal(inside("C:\\archive", "C:\\outside"), false);
  assert.throws(
    () => validateRecord({ weekId: "2026-W34" }, "engineering-weekly"),
    /CONFLUENCE_SCHEMA_ENGINEERING_WEEKLY_MISSING/,
  );
});

test("allows forward-compatible human records but keeps their required core", () => {
  assert.equal(
    validateRecord(
      {
        schemaVersion: "1.0",
        recordType: "human-daily",
        period: {},
        timezone: "America/New_York",
        coverage: "best-effort",
        futureExtension: true,
      },
      "human-daily",
    ),
    true,
  );
});

test("public metadata refuses every private evidence field", async () => {
  await assert.rejects(
    () => validatePublicMetadata({ weekId: "2026-W34", pdfDigest: "a", docxDigest: "b", humanEvidence: "not safe" }),
    /CONFLUENCE_PUBLIC_METADATA_PRIVATE_FIELD/,
  );
  await assert.doesNotReject(() =>
    validatePublicMetadata({
      weekId: "2026-W34",
      pdfDigest: "a",
      docxDigest: "b",
      humanEvidenceDigest: "safe identifier",
    }),
  );
  assert.equal(
    PRIVATE_METADATA_FIELDS.has("humanEvidenceDigest"),
    false,
    "safe digests may identify a private edition without exposing its content",
  );
});

test("design token baseline remains complete and immutable", async () => {
  const root = await mkdtemp(join(tmpdir(), "confluence-tokens-"));
  try {
    await writeFile(join(root, "tokens.json"), JSON.stringify(DESIGN_TOKENS));
    assert.equal(JSON.parse(await readFile(join(root, "tokens.json"), "utf8"))["glyph.section_separator"], "◆");
    assert.equal(Object.keys(DESIGN_TOKENS).length, 29);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
