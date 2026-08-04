import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format } from "prettier";

const root = process.cwd();
const projectRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const sourceSha = "e6cf3cb18de4e8854b19e1d29c94f3b492eba441";
const architectureFreezeSha = "7e85c2c9d67f7d4386d66e429dbc9f5b17b92be3";
const fixtureVersion = "homeport-phase7-integrated-v1";
const ownerDecision = "PENDING_OWNER_DECISION";
const state = "READY_FOR_OWNER_WALKTHROUGH";
const readJson = (name, directory = projectRoot) => JSON.parse(readFileSync(path.join(directory, name), "utf8"));
const unique = (values) => [...new Set(values.filter(Boolean))];
const routeMatches = (pattern, actual) => {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(/\\\[[^\]]+\\\]/gu, "[^/]+");
  return new RegExp(`^${escaped}$`, "u").test(actual);
};
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function writeJson(name, value, directory = projectRoot) {
  writeFileSync(
    path.join(directory, name),
    await format(JSON.stringify(value), { parser: "json", printWidth: 120 }),
    "utf8",
  );
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers = [], ...records] = rows;
  return {
    headers,
    records: records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))),
  };
}

const quoteCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
function writeCsv(name, headers, records) {
  const text = `${headers.map(quoteCsv).join(",")}\n${records
    .map((record) => headers.map((header) => quoteCsv(record[header])).join(","))
    .join("\n")}\n`;
  writeFileSync(path.join(projectRoot, name), text, "utf8");
}

const evidence = readJson(
  "Project_Homeport_Phase_7_Evidence_Metadata.json",
  path.join(projectRoot, "evidence", "phase7"),
);
const registry = readJson("Project_Homeport_Phase_7_Integrated_Journey_Registry.json");
if (evidence.sourceSha !== sourceSha || registry.sourceSha !== sourceSha)
  throw new Error("PHASE7_CONTROL_SOURCE_MISMATCH");
if (evidence.result !== "PASSED" || registry.journeys.some((journey) => journey.result !== "PASSED"))
  throw new Error("PHASE7_CONTROL_JOURNEYS_NOT_PASSED");

const phase7Implementation = {
  state,
  sourceSha,
  architectureFreezeSha,
  fixtureVersion,
  journeyCount: registry.journeys.length,
  evidenceCount: evidence.frames.length,
  ownerDecision,
  branch: "codex/project-homeport-product-reality-recovery",
  limitations: ["Not merged", "Not deployed", "No owner acceptance", "Local synthetic evidence only"],
};

const journeyCatalog = readJson("Homeport_Journey_Catalog.json");
const phase7Ids = new Set(registry.journeys.map((journey) => `HP-P7-JRN-${journey.journeyId}`));
journeyCatalog.journeys = journeyCatalog.journeys.filter((journey) => !phase7Ids.has(journey.journeyId));
journeyCatalog.journeys.push(
  ...registry.journeys.map((journey) => ({
    journeyId: `HP-P7-JRN-${journey.journeyId}`,
    name: journey.name,
    sourceSha,
    fixtureIdentity: `${fixtureVersion}:${journey.fixtureClone}`,
    browser: "Chromium 141.0.7390.37 against an isolated production runtime",
    viewport: `${journey.viewport.width}x${journey.viewport.height}`,
    steps: ["Start at /", ...journey.routeMilestones.map((route) => `Reach ${route} through visible controls`)],
    controlsUsed: journey.requiredControls,
    routeTransitions: journey.routeMilestones,
    sessionAuthoritiesObservedWithoutValues: ["HP-SES-001"],
    expectedCurrentBehavior: journey.purpose,
    observedBehavior: "Exact-source isolated production-browser journey passed.",
    screenshots: journey.evidenceIds,
    traces: [],
    result: "PASSED",
    rootBlocker: null,
    relatedNonconformityIds: ["HP-NC-015", "HP-NC-019", "HP-NC-020"],
    targetPhase: "PHASE_7",
    futureAcceptanceTest: `homeport.phase7.journey-${journey.journeyId.toLocaleLowerCase("en-US")}`,
  })),
);
journeyCatalog.phase7Implementation = phase7Implementation;
await writeJson("Homeport_Journey_Catalog.json", journeyCatalog);

const visual = readJson("Homeport_Visual_Baseline_Manifest.json");
const phase7EvidenceIds = new Set(evidence.frames.map((frame) => frame.evidenceId));
visual.records = (visual.records ?? []).filter((record) => !phase7EvidenceIds.has(record.evidenceId));
visual.phase7Run = evidence;
visual.phase7Implementation = phase7Implementation;
await writeJson("Homeport_Visual_Baseline_Manifest.json", visual);

const routes = readJson("Homeport_Route_Inventory.json");
const evidenceByRouteId = new Map();
for (const frame of evidence.frames) {
  const route =
    routes.routes.find((candidate) => candidate.routePattern === frame.route) ??
    routes.routes.find(
      (candidate) => candidate.routePattern.includes("[") && routeMatches(candidate.routePattern, frame.route),
    );
  if (!route) throw new Error(`PHASE7_EVIDENCE_ROUTE_MISSING:${frame.route}`);
  evidenceByRouteId.set(route.routeId, unique([...(evidenceByRouteId.get(route.routeId) ?? []), frame.evidenceId]));
}

for (const name of ["Homeport_Screen_Catalog.json", "Homeport_Screen_Contract_Catalog.json"]) {
  const catalog = readJson(name);
  for (const screen of catalog.screens) {
    screen.screenshotIds = (screen.screenshotIds ?? []).filter((id) => !phase7EvidenceIds.has(id));
    screen.journeyIds = (screen.journeyIds ?? []).filter((id) => !phase7Ids.has(id));
    delete screen.phase7Implementation;
    const ids = unique((screen.routeIds ?? []).flatMap((routeId) => evidenceByRouteId.get(routeId) ?? []));
    if (ids.length) {
      screen.screenshotIds = unique([...(screen.screenshotIds ?? []), ...ids]);
      screen.journeyIds = unique([
        ...(screen.journeyIds ?? []),
        ...registry.journeys
          .filter((journey) => journey.evidenceIds.some((id) => ids.includes(id)))
          .map((journey) => `HP-P7-JRN-${journey.journeyId}`),
      ]);
      screen.phase7Implementation = { state, sourceSha, evidenceIds: ids };
    }
  }
  catalog.phase7Implementation = phase7Implementation;
  await writeJson(name, catalog);
}

for (const route of routes.routes) {
  delete route.phase7Implementation;
  const ids = evidenceByRouteId.get(route.routeId) ?? [];
  if (ids.length) route.phase7Implementation = { state, sourceSha, evidenceIds: ids };
}
routes.phase7Implementation = phase7Implementation;
await writeJson("Homeport_Route_Inventory.json", routes);

const ledger = parseCsv(readFileSync(path.join(projectRoot, "Homeport_Nonconformity_Ledger.csv"), "utf8"));
const decisions = new Map([
  ["HP-NC-015", "CLOSED_PHASE_7_WALKTHROUGH_READY"],
  ["HP-NC-019", "CLOSED_PHASE_7_FIXTURE_VALIDATED"],
  ["HP-NC-020", "WAITING_FOR_OWNER_DECISION"],
]);
for (const [id, disposition] of decisions) {
  const record = ledger.records.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`PHASE7_NONCONFORMITY_MISSING:${id}`);
  record.current_status = disposition;
  record.disposition = disposition;
  record.journeys = unique([
    ...record.journeys.split(";"),
    ...registry.journeys.map((journey) => `HP-P7-JRN-${journey.journeyId}`),
  ]).join(";");
  record.evidence_ids = unique([
    ...record.evidence_ids.split(";"),
    ...evidence.frames.map((frame) => frame.evidenceId),
  ]).join(";");
  record.test_ids = unique([
    ...record.test_ids.split(";"),
    ...registry.journeys.flatMap((journey) => journey.testContractIds),
  ]).join(";");
  record.notes = unique([
    ...record.notes.split(";").map((item) => item.trim()),
    id === "HP-NC-020"
      ? "Phase 7 is ready for owner walkthrough, and only the owner can record the product-acceptance decision."
      : "Phase 7 closure is exact-source, local, synthetic, branch-only, and not owner acceptance.",
  ]).join("; ");
}
writeCsv("Homeport_Nonconformity_Ledger.csv", ledger.headers, ledger.records);

const auditPath = path.join(projectRoot, "Homeport_Journey_Audit.md");
let audit = readFileSync(auditPath, "utf8");
const block = `<!-- PHASE7_WHOLE_VOYAGE_START -->

## Phase 7 whole-voyage amendment

Journeys A through O passed against exact product source \`${sourceSha}\`, the immutable \`${fixtureVersion}\` seed, and isolated per-journey database clones. Sixteen checksum-bound production-runtime captures received Codex visual review. HP-NC-015 is \`CLOSED_PHASE_7_WALKTHROUGH_READY\`; HP-NC-019 is \`CLOSED_PHASE_7_FIXTURE_VALIDATED\`; HP-NC-020 is \`WAITING_FOR_OWNER_DECISION\`. Status: **READY_FOR_OWNER_WALKTHROUGH**. Owner decision: **PENDING_OWNER_DECISION**. This is not merge, deployment, live-provider, or owner-acceptance proof.

<!-- PHASE7_WHOLE_VOYAGE_END -->`;
if (/<!-- PHASE7_WHOLE_VOYAGE_START -->[\s\S]*?<!-- PHASE7_WHOLE_VOYAGE_END -->/u.test(audit))
  audit = audit.replace(/<!-- PHASE7_WHOLE_VOYAGE_START -->[\s\S]*?<!-- PHASE7_WHOLE_VOYAGE_END -->/u, block);
else audit = `${audit.trimEnd()}\n\n${block}\n`;
writeFileSync(auditPath, audit, "utf8");

process.stdout.write(
  `${JSON.stringify({ status: "HOMEPORT_PHASE7_CONTROL_PLANE_UPDATED", sourceSha, journeys: registry.journeys.length, evidence: evidence.frames.length, digest: digest({ phase7Implementation, registry, evidence }) })}\n`,
);
