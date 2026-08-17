import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, open, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

export const CONFLUENCE_VERSION = "1.0";
export const ARCHIVE_REPOSITORY = "Kgray44/voyagewright-journal-archive";
export const PUBLIC_REPOSITORY = "Kgray44/treasurehuntSoT";
export const TIMEZONE = "America/New_York";
const GIT_BINARY = process.env.CONFLUENCE_GIT_EXECUTABLE || "git";
export const DESIGN_TOKENS = {
  "page.format": "A4 portrait",
  "page.width_mm": "210",
  "page.height_mm": "297",
  "page.margin_left_mm": "6",
  "page.margin_right_mm": "6",
  "page.margin_top_mm": "6",
  "page.margin_bottom_mm": "6",
  "font.body_family": "Georgia",
  "font.display_family": "Arial",
  "font.body_pt": "10.5",
  "font.section_title_pt": "24",
  "font.section_subtitle_pt": "12.5",
  "font.pull_quote_pt": "15.5",
  "font.running_pt": "8.5",
  "font.table_pt": "9.5",
  "font.caption_pt": "8.7",
  "color.deep_teal": "#173F4C",
  "color.harbor_teal": "#2E7D7B",
  "color.warm_gold": "#C39A45",
  "color.editorial_cream": "#F4F0E5",
  "color.warm_brown": "#6F5146",
  "color.running_gray": "#7A7D80",
  "color.body_ink": "#222222",
  "glyph.section_separator": "◆",
  "body.line_spacing": "1.11",
  "body.paragraph_after_pt": "5",
  "pull_quote.max_width_mm": "130",
  "section.clean_page_body_start_mm": "60",
  "table.border_pt": "0.5",
};

export const PRIVATE_METADATA_FIELDS = new Set([
  "humanEvidence",
  "humanEvidencePath",
  "sourceChats",
  "themeAnalysis",
  "narrativeOutline",
  "privatePath",
  "privateArchivePath",
  "personalMeaning",
  "relationshipAndPurposeContext",
]);

export function digest(value) {
  return createHash("sha256")
    .update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest("hex");
}

export function now() {
  return new Date().toISOString();
}

export function assertWeekId(weekId) {
  if (!/^\d{4}-W\d{2}$/.test(weekId ?? "")) throw new Error("CONFLUENCE_INVALID_WEEK_ID");
  return weekId;
}

export function weekFor(date = new Date()) {
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const part = Object.fromEntries(local.map(({ type, value }) => [type, value]));
  const d = new Date(`${part.year}-${part.month}-${part.day}T12:00:00Z`);
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[part.weekday];
  d.setUTCDate(d.getUTCDate() - weekday + 1);
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thursday - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  const start = `${part.year}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T00:00:00-04:00`;
  const endDate = new Date(d);
  endDate.setUTCDate(d.getUTCDate() + 7);
  const end = `${part.year}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}T00:00:00-04:00`;
  return { weekId: `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`, start, end, timezone: TIMEZONE };
}

function offsetFor(date) {
  const value = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  return value?.replace("GMT", "") || "-05:00";
}

export function periodForWeek(weekId) {
  assertWeekId(weekId);
  const [year, number] = weekId.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(year, 0, 4, 12));
  const weekday = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - weekday + (number - 1) * 7);
  const end = new Date(monday);
  end.setUTCDate(monday.getUTCDate() + 7);
  const stamp = (date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T00:00:00${offsetFor(date)}`;
  return { weekId, start: stamp(monday), end: stamp(end), timezone: TIMEZONE };
}

export function parsePeriod(options = {}) {
  if (options.week) return periodForWeek(options.week);
  if (options.start && options.end)
    return {
      weekId: options.week ?? weekFor(new Date(options.start)).weekId,
      start: options.start,
      end: options.end,
      timezone: TIMEZONE,
    };
  if (options.rollingDays || options.last7Days) {
    const end = new Date();
    const start = new Date(end.getTime() - Number(options.rollingDays ?? 7) * 86400000);
    return { weekId: weekFor(start).weekId, start: start.toISOString(), end: end.toISOString(), timezone: TIMEZONE };
  }
  const previous = new Date();
  previous.setDate(previous.getDate() - 7);
  return weekFor(previous);
}

export function archiveWeekDirectory(archiveRoot, weekId, stream = "engineering") {
  assertWeekId(weekId);
  const year = weekId.slice(0, 4);
  return join(archiveRoot, stream, "weekly", year, weekId);
}

export function inside(root, target) {
  const r = resolve(root);
  const t = resolve(target);
  return t === r || t.startsWith(`${r}${sep}`);
}

export async function readJson(path, fallback = undefined) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}
export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
export async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function acquireArchiveLock(archiveRoot, name) {
  if (!/^[a-z0-9-]+$/i.test(name)) throw new Error("CONFLUENCE_INVALID_LOCK_NAME");
  const path = join(archiveRoot, ".confluence-locks", `${name}.json`);
  await mkdir(dirname(path), { recursive: true });
  let handle;
  try {
    handle = await open(path, "wx");
    await handle.writeFile(JSON.stringify({ name, acquiredAt: now(), pid: process.pid }));
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`CONFLUENCE_ARCHIVE_LOCKED_${name}`);
    throw error;
  }
  return async () => {
    await handle.close();
    await unlink(path);
  };
}

export function git(repo, args) {
  return execFileSync(GIT_BINARY, ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export async function verifyArchivePrivacy(archiveRoot, { allowRecordedAttestation = false } = {}) {
  const remote = git(archiveRoot, ["remote", "get-url", "origin"]);
  if (!remote.includes("voyagewright-journal-archive")) throw new Error("CONFLUENCE_ARCHIVE_REMOTE_MISMATCH");
  const anonymous = await fetch(`https://api.github.com/repos/${ARCHIVE_REPOSITORY}`, {
    headers: { "User-Agent": "project-confluence" },
  });
  let authenticatedRead = false;
  try {
    execFileSync(GIT_BINARY, ["ls-remote", "--heads", remote], { stdio: "ignore", timeout: 15_000 });
    authenticatedRead = true;
  } catch {
    /* fail below */
  }
  if (anonymous.status === 404 && authenticatedRead)
    return { visibility: "PRIVATE", method: "anonymous-404-plus-authenticated-git", verifiedAt: now() };
  if (allowRecordedAttestation) {
    const attestation = await readJson(join(archiveRoot, "references", "archive-privacy-attestation.json"));
    if (attestation?.visibility === "PRIVATE") return { ...attestation, method: "recorded-attestation" };
  }
  throw new Error("CONFLUENCE_ARCHIVE_PRIVACY_UNVERIFIED");
}

export function validateRecord(record, type) {
  const required =
    {
      "human-daily": ["schemaVersion", "recordType", "period", "timezone", "coverage"],
      "human-weekly": ["schemaVersion", "weekId", "period", "timezone", "coverage"],
      "engineering-weekly": ["schemaVersion", "weekId", "period", "timezone", "repository", "coverage", "sources"],
      "theme-analysis": ["schemaVersion", "weekId", "candidates"],
      "journal-metadata": ["weekId", "period", "authoringActor", "designVersion"],
      "publish-safety": ["weekId", "status", "assessedAt"],
      "source-manifest": ["schemaVersion", "period", "generator", "generatedAt", "digest"],
      "replay-run": ["runId", "period", "timezone", "state", "createdAt"],
    }[type] ?? [];
  const missing = required.filter((key) => record?.[key] === undefined || record[key] === null || record[key] === "");
  if (missing.length)
    throw new Error(`CONFLUENCE_SCHEMA_${type.toUpperCase().replaceAll("-", "_")}_MISSING_${missing.join("_")}`);
  if (record.weekId) assertWeekId(record.weekId);
  return true;
}

function sourceStatus(value) {
  return { kind: "FACT", value };
}
function unavailable(reason) {
  return { kind: "UNAVAILABLE", value: "UNAVAILABLE_FROM_CURRENT_EVIDENCE", reason };
}

export async function collectEngineering({ archiveRoot, repositoryRoot, period, dryRun = false }) {
  await verifyArchivePrivacy(archiveRoot, { allowRecordedAttestation: false });
  const weekId = assertWeekId(period.weekId);
  const destination = archiveWeekDirectory(archiveRoot, weekId);
  const log = git(repositoryRoot, [
    "log",
    "origin/main",
    "--pretty=format:%H%x1f%aI%x1f%an%x1f%s",
    `--since=${period.start}`,
    `--before=${period.end}`,
  ]);
  const commits = log
    ? log.split("\n").map((line) => {
        const [sha, authoredAt, author, subject] = line.split("\x1f");
        return { kind: "FACT", sha, authoredAt, author, subject };
      })
    : [];
  const mainStartSha = git(repositoryRoot, ["rev-list", "-1", `--before=${period.start}`, "origin/main"]);
  const mainEndSha = git(repositoryRoot, ["rev-list", "-1", `--before=${period.end}`, "origin/main"]);
  const sources = [{ type: "git", repository: PUBLIC_REPOSITORY, mainStartSha, mainEndSha, collectedAt: now() }];
  const engineering = {
    schemaVersion: CONFLUENCE_VERSION,
    recordType: "engineering-weekly",
    weekId,
    period,
    timezone: TIMEZONE,
    generatedAt: now(),
    repository: PUBLIC_REPOSITORY,
    mainStartSha,
    mainEndSha,
    mainStartTree: git(repositoryRoot, ["rev-parse", `${mainStartSha}^{tree}`]),
    mainEndTree: git(repositoryRoot, ["rev-parse", `${mainEndSha}^{tree}`]),
    commits,
    mergedPullRequests: unavailable("GitHub PR metadata was not available to the local collector"),
    openedPullRequests: unavailable("GitHub PR metadata was not available to the local collector"),
    closedPullRequests: unavailable("GitHub PR metadata was not available to the local collector"),
    projectChanges: sourceStatus([]),
    phaseOrIncrementCompletions: sourceStatus([]),
    projectStarts: sourceStatus([]),
    projectResumptions: sourceStatus([]),
    architectureChanges: sourceStatus([]),
    importantBugFixes: sourceStatus([]),
    importantFailures: sourceStatus([]),
    failureResolutions: sourceStatus([]),
    testAndValidationEvidence: unavailable("No governed weekly validation summary was selected automatically"),
    SoundingLineEvidence: unavailable("No governed weekly Sounding Line result was selected automatically"),
    workflowEvidence: unavailable("GitHub workflow metadata was not available to the local collector"),
    migrations: sourceStatus([]),
    schemaChanges: sourceStatus([]),
    dependencyChanges: sourceStatus([]),
    buildChanges: sourceStatus([]),
    releaseChanges: sourceStatus([]),
    tags: sourceStatus([]),
    repositoryMetrics: { kind: "DERIVED_METRIC", commitCount: commits.length, basis: "Git commits inside the period" },
    weeklyGrowthMetrics: unavailable("Historical file-growth metric is not collected"),
    notableFiles: sourceStatus([]),
    notableSubsystems: sourceStatus([]),
    openRisks: sourceStatus([]),
    knownBlockers: sourceStatus([]),
    unfinishedWork: sourceStatus([]),
    sources,
    sourceDigest: digest({ mainStartSha, mainEndSha, commits }),
    coverage: commits.length ? "exact-origin-main-history" : "exact-origin-main-history-no-commits",
    limitations: [
      "No personal or human interpretation is collected.",
      "Unavailable GitHub-only metrics are explicitly marked unavailable.",
    ],
  };
  validateRecord(engineering, "engineering-weekly");
  const manifest = {
    schemaVersion: CONFLUENCE_VERSION,
    recordType: "source-manifest",
    period,
    generator: "Codex Project Confluence Engineering Collector",
    generatedAt: now(),
    sourceRepository: PUBLIC_REPOSITORY,
    sourceCommit: mainEndSha,
    sourceReferences: sources,
    digest: digest(engineering),
  };
  validateRecord(manifest, "source-manifest");
  const existing = await readJson(join(destination, "engineering.json"));
  if (
    existing &&
    existing.sourceDigest === engineering.sourceDigest &&
    JSON.stringify(existing.period) === JSON.stringify(period)
  )
    return { status: "IDEMPOTENT", weekId, destination, digest: digest(existing) };
  if (existing) {
    const revisionsRoot = join(destination, "revisions");
    if (await exists(revisionsRoot)) {
      for (const revisionName of await readdir(revisionsRoot)) {
        const revision = join(revisionsRoot, revisionName);
        const candidate = await readJson(join(revision, "engineering.json"));
        if (
          candidate?.sourceDigest === engineering.sourceDigest &&
          JSON.stringify(candidate.period) === JSON.stringify(period)
        ) {
          return { status: "IDEMPOTENT", weekId, destination: revision, digest: digest(candidate) };
        }
      }
    }
    const revision = join(
      destination,
      "revisions",
      `${now().replaceAll(/[:.]/g, "-")}-${digest(engineering).slice(0, 12)}`,
    );
    if (!dryRun) {
      await writeJson(join(revision, "engineering.json"), engineering);
      await writeJson(join(revision, "source-manifest.json"), manifest);
    }
    return { status: "REVISION_CREATED", weekId, destination: revision, digest: digest(engineering) };
  }
  if (!dryRun) {
    await writeJson(join(destination, "engineering.json"), engineering);
    await writeFile(
      join(destination, "engineering.md"),
      `# Engineering evidence - ${weekId}\n\nThis factual digest is not a journal.\n\n- Coverage: ${engineering.coverage}\n- Git commits: ${commits.length}\n- Main start: ${mainStartSha}\n- Main end: ${mainEndSha}\n- GitHub-only metrics: UNAVAILABLE_FROM_CURRENT_EVIDENCE\n`,
    );
    await writeJson(join(destination, "source-manifest.json"), manifest);
  }
  return { status: dryRun ? "DRY_RUN" : "COLLECTED", weekId, destination, digest: digest(engineering) };
}

export async function statusForWeek({ archiveRoot, publicRoot, weekId }) {
  assertWeekId(weekId);
  const year = weekId.slice(0, 4);
  const engineering = join(archiveWeekDirectory(archiveRoot, weekId), "engineering.json");
  const human = join(archiveRoot, "human", "weekly", year, weekId, "human.json");
  const journal = join(archiveRoot, "journals", year, weekId, "journal-metadata.json");
  const safety = join(archiveRoot, "journals", year, weekId, "publish-safety.json");
  const publicMetadata = join(publicRoot, "Developer_Journals", year, weekId, "metadata.json");
  return {
    weekId,
    HUMAN_EVIDENCE_READY: await exists(human),
    ENGINEERING_EVIDENCE_READY: await exists(engineering),
    DESIGN_AUTHORITY_READY: await exists(join(archiveRoot, "references", "journal-design-tokens.json")),
    MASTER_READY: await exists(journal),
    PUBLISH_SAFETY_READY: await exists(safety),
    PUBLIC_DELIVERY_READY: await exists(publicMetadata),
    readiness: (await exists(human)) && (await exists(engineering)) ? "READY_FOR_SYNTHESIS" : "WAITING_FOR_EVIDENCE",
  };
}

export async function validateDesign({ archiveRoot, metadataPath }) {
  const tokens = await readJson(join(archiveRoot, "references", "journal-design-tokens.json"));
  for (const [key, value] of Object.entries(DESIGN_TOKENS))
    if (tokens?.[key] !== value) throw new Error(`CONFLUENCE_DESIGN_TOKEN_DRIFT_${key}`);
  const metadata = await readJson(metadataPath);
  validateRecord(metadata, "journal-metadata");
  if (metadata.designVersion !== CONFLUENCE_VERSION) throw new Error("CONFLUENCE_DESIGN_VERSION_MISMATCH");
  return { status: "DESIGN_VALID", designTokenDigest: digest(tokens), metadataDigest: digest(metadata) };
}

export async function inspectPdf(pdfPath) {
  const bytes = await readFile(pdfPath);
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("CONFLUENCE_PDF_INVALID_HEADER");
  const text = bytes.toString("latin1");
  const match = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  if (!match) throw new Error("CONFLUENCE_PDF_MEDIABOX_MISSING");
  const width = Number(match[1]),
    height = Number(match[2]);
  if (Math.abs(width - 595.3) > 2 || Math.abs(height - 841.9) > 2) throw new Error("CONFLUENCE_PDF_NOT_A4");
  return { width, height, pageCount: (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length };
}

export async function inspectDocx(docxPath) {
  const header = (await readFile(docxPath)).subarray(0, 2);
  if (!header.equals(Buffer.from("PK"))) throw new Error("CONFLUENCE_DOCX_INVALID_ZIP");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    "$zip = [System.IO.Compression.ZipFile]::OpenRead($env:CONFLUENCE_DOCX_INSPECT_PATH)",
    "try {",
    "  $document = ([System.IO.StreamReader]::new($zip.GetEntry('word/document.xml').Open())).ReadToEnd()",
    "  $styles = ([System.IO.StreamReader]::new($zip.GetEntry('word/styles.xml').Open())).ReadToEnd()",
    "  [pscustomobject]@{a4=($document -match 'w:w=\"11906\"' -and $document -match 'w:h=\"16838\"'); margins=($document -match 'w:left=\"340\"' -and $document -match 'w:right=\"340\"' -and $document -match 'w:top=\"340\"' -and $document -match 'w:bottom=\"340\"'); headings=($styles -match 'Heading'); tableHeaders=($document -match 'w:tblHeader'); altText=($document -match 'descr=') } | ConvertTo-Json -Compress",
    "} finally { $zip.Dispose() }",
  ].join("; ");
  const output = execFileSync("powershell", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    env: { ...process.env, CONFLUENCE_DOCX_INSPECT_PATH: docxPath },
  }).trim();
  const details = JSON.parse(output);
  if (!details.a4) throw new Error("CONFLUENCE_DOCX_NOT_A4");
  if (!details.margins) throw new Error("CONFLUENCE_DOCX_MARGIN_DRIFT");
  if (!details.headings) throw new Error("CONFLUENCE_DOCX_HEADING_STYLES_MISSING");
  return details;
}

export async function validateMasterArtifacts({ archiveRoot, weekId }) {
  assertWeekId(weekId);
  const year = weekId.slice(0, 4);
  const source = join(archiveRoot, "journals", year, weekId);
  const metadataPath = join(source, "journal-metadata.json");
  const metadata = await readJson(metadataPath);
  await validateDesign({ archiveRoot, metadataPath });
  const [docxPath, pdfPath] = [join(source, "master.docx"), join(source, "master.pdf")];
  if (!(await exists(docxPath)) || !(await exists(pdfPath))) throw new Error("CONFLUENCE_MASTER_ARTIFACT_MISSING");
  const [docx, pdf] = await Promise.all([inspectDocx(docxPath), inspectPdf(pdfPath)]);
  const [docxDigest, pdfDigest] = await Promise.all([readFile(docxPath).then(digest), readFile(pdfPath).then(digest)]);
  if (metadata.docxDigest && metadata.docxDigest !== docxDigest) throw new Error("CONFLUENCE_DOCX_DIGEST_MISMATCH");
  if (metadata.pdfDigest && metadata.pdfDigest !== pdfDigest) throw new Error("CONFLUENCE_PDF_DIGEST_MISMATCH");
  return { status: "MASTER_ARTIFACTS_VALID", docx, pdf, docxDigest, pdfDigest };
}

export async function validateArchiveLayout(archiveRoot) {
  const schemaNames = [
    "human-daily",
    "human-weekly",
    "engineering-weekly",
    "source-manifest",
    "theme-analysis",
    "narrative-design",
    "journal-metadata",
    "publish-safety",
    "delivery-receipt",
    "replay-run",
    "archive-index",
  ];
  for (const name of schemaNames)
    if (!(await exists(join(archiveRoot, "schemas", `${name}.schema.json`))))
      throw new Error(`CONFLUENCE_ARCHIVE_SCHEMA_MISSING_${name}`);
  const tokens = await readJson(join(archiveRoot, "references", "journal-design-tokens.json"));
  for (const [key, value] of Object.entries(DESIGN_TOKENS))
    if (tokens?.[key] !== value) throw new Error(`CONFLUENCE_ARCHIVE_TOKEN_DRIFT_${key}`);
  for (const index of ["journal-index.json", "evidence-index.json", "replay-index.json"]) {
    const value = await readJson(join(archiveRoot, "indexes", index));
    if (!Array.isArray(value?.entries) || value.schemaVersion !== CONFLUENCE_VERSION)
      throw new Error(`CONFLUENCE_ARCHIVE_INDEX_INVALID_${index}`);
  }
  return { status: "ARCHIVE_VALID", schemaCount: schemaNames.length, designTokenDigest: digest(tokens) };
}

export async function validatePublicMetadata(metadata) {
  for (const key of Object.keys(metadata ?? {})) {
    const safeReference = /(Digest|Id)$/.test(key);
    if (PRIVATE_METADATA_FIELDS.has(key) || (!safeReference && /human|theme|narrative|private/i.test(key)))
      throw new Error(`CONFLUENCE_PUBLIC_METADATA_PRIVATE_FIELD_${key}`);
  }
  if (!metadata?.weekId || !metadata?.pdfDigest || !metadata?.docxDigest)
    throw new Error("CONFLUENCE_PUBLIC_METADATA_INCOMPLETE");
  return true;
}

export async function deliverExact({
  archiveRoot,
  publicRoot,
  weekId,
  dryRun = false,
  privacyVerifier = verifyArchivePrivacy,
}) {
  await privacyVerifier(archiveRoot, { allowRecordedAttestation: false });
  assertWeekId(weekId);
  const year = weekId.slice(0, 4);
  const source = join(archiveRoot, "journals", year, weekId);
  const safety = await readJson(join(source, "publish-safety.json"));
  validateRecord(safety, "publish-safety");
  if (safety.status !== "SAFE_TO_MIRROR_EXACT")
    throw new Error(`CONFLUENCE_PUBLICATION_${safety.status ?? "BLOCKED_MISSING_ASSESSMENT"}`);
  const metadata = await readJson(join(source, "journal-metadata.json"));
  const artifactValidation = await validateMasterArtifacts({ archiveRoot, weekId });
  const docx = join(source, "master.docx"),
    pdf = join(source, "master.pdf");
  if (!(await exists(docx)) || !(await exists(pdf))) throw new Error("CONFLUENCE_MASTER_ARTIFACT_MISSING");
  const target = join(publicRoot, "Developer_Journals", year, weekId);
  const publicMetadata = {
    weekId,
    period: metadata.period,
    title: metadata.title,
    subtitle: metadata.subtitle,
    publicationDate: now(),
    designVersion: metadata.designVersion,
    docxDigest: artifactValidation.docxDigest,
    pdfDigest: artifactValidation.pdfDigest,
    sourceEditionDigest: digest(metadata),
    publicationStatus: "SAFE_TO_MIRROR_EXACT",
  };
  await validatePublicMetadata(publicMetadata);
  if (!dryRun) {
    await mkdir(target, { recursive: true });
    await copyFile(docx, join(target, `Voyagewright_Developer_Journal_${weekId}.docx`));
    await copyFile(pdf, join(target, `Voyagewright_Developer_Journal_${weekId}.pdf`));
    await writeJson(join(target, "metadata.json"), publicMetadata);
  }
  return { status: dryRun ? "DRY_RUN" : "DELIVERED_EXACT", weekId, target, publicMetadata };
}

export async function replay({ archiveRoot, publicRoot, repositoryRoot, period, runId = `replay-${randomUUID()}` }) {
  await verifyArchivePrivacy(archiveRoot, { allowRecordedAttestation: false });
  const runRoot = join(archiveRoot, "replays", runId);
  if (!inside(join(archiveRoot, "replays"), runRoot)) throw new Error("CONFLUENCE_REPLAY_PATH_ESCAPE");
  const existing = await readJson(join(runRoot, "replay-run.json"));
  const state = existing ?? {
    schemaVersion: CONFLUENCE_VERSION,
    recordType: "replay-run",
    runId,
    period,
    timezone: TIMEZONE,
    state: "CREATED",
    createdAt: now(),
    history: [],
  };
  const transition = async (next) => {
    state.state = next;
    state.history.push({ state: next, at: now() });
    await writeJson(join(runRoot, "replay-run.json"), state);
  };
  await transition("COLLECTING_ENGINEERING");
  const collection = await collectEngineering({ archiveRoot, repositoryRoot, period });
  state.engineering = collection;
  const humanPath = join(archiveRoot, "human", "weekly", period.weekId.slice(0, 4), period.weekId, "human.json");
  if (!(await exists(humanPath))) {
    await writeJson(join(archiveRoot, "requests", "human-replay", `${runId}.json`), {
      runId,
      period,
      timezone: TIMEZONE,
      desiredWeeklyOutputPath: relative(
        archiveRoot,
        join(archiveRoot, "human", "weekly", period.weekId.slice(0, 4), period.weekId, "human.json"),
      ).replaceAll("\\", "/"),
      currentEvidenceStatus: "WAITING_FOR_HUMAN_EVIDENCE",
      createdAt: now(),
    });
    await transition("WAITING_FOR_HUMAN_EVIDENCE");
    return state;
  }
  await transition("READY_FOR_SYNTHESIS");
  await transition("WAITING_FOR_MASTER_AUTHOR");
  return state;
}

export async function updateEvidenceIndex(archiveRoot, entry) {
  const path = join(archiveRoot, "indexes", "evidence-index.json");
  const current = await readJson(path, { schemaVersion: CONFLUENCE_VERSION, entries: [] });
  const entries = [...current.entries.filter((candidate) => candidate.id !== entry.id), entry].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  await writeJson(path, { ...current, entries, updatedAt: now() });
  return entries;
}
