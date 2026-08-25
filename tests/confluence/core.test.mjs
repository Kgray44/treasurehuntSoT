import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DESIGN_TOKENS,
  PRIVATE_METADATA_FIELDS,
  assertWeekId,
  deliverExact,
  digest,
  humanEvidenceForWeek,
  inside,
  inspectDocx,
  inspectPdf,
  periodForWeek,
  updateEvidenceIndex,
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

test("recognizes a validated human evidence source without rewriting it", async () => {
  const root = await mkdtemp(join(tmpdir(), "confluence-human-source-"));
  try {
    const directory = join(root, "human", "weekly", "2026", "2026-W34");
    await mkdir(directory, { recursive: true });
    const source = {
      schema_version: "1.0",
      record_type: "weekly_human_evidence",
      week: { iso_week: "2026-W34", timezone: "America/New_York" },
      coverage: { overall_confidence: "partial" },
      evidence_policy: { method: "human-only" },
    };
    await writeFile(join(directory, "human-evidence.json"), JSON.stringify(source));
    const located = await humanEvidenceForWeek(root, "2026-W34");
    assert.equal(located.format, "confluence-human-source-weekly-v1");
    assert.equal(located.path, join(directory, "human-evidence.json"));
    await writeFile(join(directory, "human-evidence.json"), JSON.stringify({ ...source, week: {} }));
    await assert.rejects(() => humanEvidenceForWeek(root, "2026-W34"), /CONFLUENCE_HUMAN_EVIDENCE_SOURCE_INVALID/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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

test("evidence index records only deterministic private-archive locators", async () => {
  const root = await mkdtemp(join(tmpdir(), "confluence-index-"));
  try {
    const entry = {
      id: `engineering:2026-W34:${"a".repeat(64)}`,
      recordType: "engineering-weekly",
      weekId: "2026-W34",
      path: "engineering/weekly/2026/2026-W34/engineering.json",
      sourceDigest: "a".repeat(64),
      manifestDigest: "b".repeat(64),
    };
    assert.deepEqual(await updateEvidenceIndex(root, entry), [entry]);
    const first = JSON.parse(await readFile(join(root, "indexes", "evidence-index.json"), "utf8"));
    assert.deepEqual(await updateEvidenceIndex(root, entry), [entry]);
    const second = JSON.parse(await readFile(join(root, "indexes", "evidence-index.json"), "utf8"));
    assert.deepEqual(second, first, "an unchanged index does not churn timestamps on an idempotent replay");
    await assert.rejects(
      () => updateEvidenceIndex(root, { ...entry, id: "engineering:2026-W34:missing", sourceDigest: undefined }),
      /CONFLUENCE_EVIDENCE_INDEX_SOURCE_DIGEST_REQUIRED/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validates A4 PDF and DOCX structural invariants", async () => {
  const root = await mkdtemp(join(tmpdir(), "confluence-documents-"));
  try {
    const pdf = join(root, "master.pdf");
    await writeFile(pdf, "%PDF-1.7\n1 0 obj<</Type /Page /MediaBox [0 0 595.3 841.9]>>endobj\n%%EOF");
    assert.equal((await inspectPdf(pdf)).pageCount, 1);
    await assert.rejects(async () => inspectPdf(join(root, "missing.pdf")));

    const source = join(root, "docx-source");
    await mkdir(join(source, "word"), { recursive: true });
    await writeFile(
      join(source, "word", "document.xml"),
      '<w:document xmlns:w="x"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:left="340" w:right="340" w:top="340" w:bottom="340"/></w:sectPr></w:body></w:document>',
    );
    await writeFile(
      join(source, "word", "styles.xml"),
      '<w:styles xmlns:w="x"><w:style w:styleId="Heading1"/></w:styles>',
    );
    const docx = join(root, "master.docx");
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::Open($env:CONFLUENCE_TEST_DOCX, [System.IO.Compression.ZipArchiveMode]::Create); try { Get-ChildItem -LiteralPath $env:CONFLUENCE_TEST_SOURCE -Recurse -File | ForEach-Object { [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $_.FullName.Substring($env:CONFLUENCE_TEST_SOURCE.Length + 1).Replace('\\', '/')) } } finally { $zip.Dispose() }",
      ],
      { env: { ...process.env, CONFLUENCE_TEST_SOURCE: source, CONFLUENCE_TEST_DOCX: docx } },
    );
    const details = await inspectDocx(docx);
    assert.equal(details.a4, true);
    assert.equal(details.margins, true);
    assert.equal(details.headings, true);

    const archive = join(root, "archive");
    const journal = join(archive, "journals", "2026", "2026-W34");
    const publicRoot = join(root, "public");
    await mkdir(join(archive, "references"), { recursive: true });
    await mkdir(journal, { recursive: true });
    await writeFile(join(archive, "references", "journal-design-tokens.json"), JSON.stringify(DESIGN_TOKENS));
    const docxBytes = await readFile(docx);
    const pdfBytes = await readFile(pdf);
    await writeFile(join(journal, "master.docx"), docxBytes);
    await writeFile(join(journal, "master.pdf"), pdfBytes);
    await writeFile(
      join(journal, "journal-metadata.json"),
      JSON.stringify({
        weekId: "2026-W34",
        period: { start: "2026-08-17T00:00:00-04:00", end: "2026-08-24T00:00:00-04:00" },
        authoringActor: "ChatGPT",
        designVersion: "1.0",
        docxDigest: digest(docxBytes),
        pdfDigest: digest(pdfBytes),
      }),
    );
    await writeFile(
      join(journal, "publish-safety.json"),
      JSON.stringify({ weekId: "2026-W34", status: "SAFE_TO_MIRROR_EXACT", assessedAt: new Date().toISOString() }),
    );
    const delivery = await deliverExact({
      archiveRoot: archive,
      publicRoot,
      weekId: "2026-W34",
      privacyVerifier: async () => ({ visibility: "PRIVATE" }),
    });
    assert.equal(delivery.status, "DELIVERED_EXACT");
    assert.deepEqual(
      await readFile(
        join(publicRoot, "Developer_Journals", "2026", "2026-W34", "Voyagewright_Developer_Journal_2026-W34.docx"),
      ),
      docxBytes,
    );
    assert.deepEqual(
      await readFile(
        join(publicRoot, "Developer_Journals", "2026", "2026-W34", "Voyagewright_Developer_Journal_2026-W34.pdf"),
      ),
      pdfBytes,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
