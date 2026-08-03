import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const auditRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const evidenceRoot = path.join(auditRoot, "evidence", "phase4");
const scopeIndex = process.argv.indexOf("--scope");
const scope = scopeIndex >= 0 ? process.argv[scopeIndex + 1] : "all";
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};
const readJson = (name, directory = auditRoot) => JSON.parse(readFileSync(path.join(directory, name), "utf8"));
const readCsv = (name) => {
  const text = readFileSync(path.join(auditRoot, name), "utf8");
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
  const [headers, ...data] = rows;
  return data.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
};
const unique = (values) => new Set(values).size === values.length;
const run = (name, validation) => {
  if (scope === "all" || scope === name) validation();
};

const requiredContracts = [
  "harbor-home",
  "content-first-default",
  "default-not-no-results",
  "district-registry",
  "district-navigation",
  "mobile-district-parity",
  "public-projection",
  "no-private-leak",
  "lifecycle-eligibility",
  "quarantine",
  "card-base",
  "card-destinations",
  "card-fallback",
  "card-accessibility",
  "shelf-strategy",
  "editorial-labeling",
  "search",
  "search-url-state",
  "search-stale-request",
  "compact-filters",
  "advanced-filters",
  "no-results",
  "empty-state",
  "dependency-unavailable",
  "partial-media-failure",
  "chronicles",
  "artifacts",
  "templates",
  "maps",
  "audio",
  "creators",
  "creator-profile",
  "collections",
  "guides",
  "voyage-logs",
  "saved-state",
  "saved-cross-surface",
  "follow-state",
  "social-auth-return",
  "detail",
  "detail-parent",
  "open-install-remix",
  "mutation-feedback",
  "restricted-account",
  "keyboard",
  "zoom",
  "reduced-motion",
  "phase1-regression",
  "phase2-regression",
  "phase3-regression",
  "artifact-idempotency",
].map((id) => `homeport.community.${id}`);
const requiredEvidence = [
  "A-harbor-home-desktop",
  "B-harbor-home-mobile",
  "C-harbor-authenticated",
  "D-harbor-empty",
  "E-featured-shelf",
  "F-district-navigation",
  "G-chronicles-district",
  "H-artifacts-district",
  "I-templates-district",
  "J-maps-district",
  "K-audio-district",
  "L-creators-district",
  "M-creator-profile",
  "N-creator-empty",
  "O-collections-district",
  "P-collection-detail",
  "Q-guides-district",
  "R-guide-detail",
  "S-voyage-logs",
  "T-chronicle-card",
  "U-listing-detail",
  "V-search-results",
  "W-no-results",
  "X-advanced-filters",
  "Y-active-filters",
  "Z-saved-state",
  "AA-image-fallback",
  "AB-quarantined-content",
  "AC-archived-removed",
  "AD-dependency-unavailable",
  "AE-mobile-filter-drawer",
  "AF-mobile-detail",
  "AG-zoom-harbor",
  "AH-zoom-filters",
  "AI-reduced-motion",
  "AJ-restricted-state",
  "AK-public-projection",
  "AL-full-community-loop",
].map((id) => `HP-P4-EV-${id}`);

run("district-registry", () => {
  const registry = readJson("Project_Homeport_Phase_4_District_Registry.json");
  const allowed = new Set([
    "ACTIVE_COMPLETE",
    "ACTIVE_EMPTY_SUPPORTED",
    "PREVIEW",
    "REDIRECT_TO_PARENT",
    "DEVELOPMENT_ONLY",
    "NOT_SUPPORTED",
  ]);
  check(registry.implementationStatus === "BRANCH_VALIDATED_NOT_MERGED", "district registry is not branch validated");
  check(registry.districts.length === 12, "district registry must retain 12 governed entries");
  check(unique(registry.districts.map((district) => district.id)), "district IDs are not unique");
  check(unique(registry.districts.map((district) => district.route)), "district routes are not unique");
  const districtIds = new Set(registry.districts.map((district) => district.id));
  for (const district of registry.districts) {
    check(allowed.has(district.status), `invalid district status: ${district.id}`);
    check(district.route.startsWith("/community"), `invalid district route: ${district.id}`);
    if (district.id === "HARBOR_HOME") check(district.parent === null, "Harbor Home must remain the registry root");
    else check(districtIds.has(district.parent), `invalid district parent: ${district.id}`);
    if (district.visibleEntry && district.id !== "HARBOR_HOME")
      check(district.parent === "HARBOR_HOME", `visible district is not parented to Harbor Home: ${district.id}`);
    check(Boolean(district.emptyAction?.href), `missing district empty action: ${district.id}`);
    if (!["PREVIEW", "DEVELOPMENT_ONLY", "NOT_SUPPORTED"].includes(district.status))
      check(district.cardVariants.length > 0, `active district lacks compatible cards: ${district.id}`);
    if (["PREVIEW", "DEVELOPMENT_ONLY", "NOT_SUPPORTED"].includes(district.status))
      check(!district.visibleEntry, `non-active district is visible: ${district.id}`);
  }
});

run("public-card", () => {
  const contract = readJson("Project_Homeport_Phase_4_Public_Card_Contract.json");
  check(
    contract.implementationStatus === "BRANCH_VALIDATED_NOT_MERGED",
    "public card contract is not branch validated",
  );
  check(contract.dto === "HomeportCommunityCard", "wrong public card DTO");
  check(
    contract.variants.length === 9 && unique(contract.variants.map((variant) => variant.id)),
    "card variants incomplete",
  );
  for (const field of [
    "id",
    "variant",
    "destination",
    "artwork",
    "title",
    "contentType",
    "primaryAction",
    "imageState",
  ])
    check(contract.baseFields.required.includes(field), `missing required public card field: ${field}`);
  for (const field of ["accountId", "email", "objectKey", "storagePath", "privateChronicleBody", "exactCoordinates"])
    check(contract.forbiddenPublicFields.includes(field), `missing forbidden public card field: ${field}`);
});

run("public-projection", () => {
  const rows = readCsv("Project_Homeport_Phase_4_Public_Projection_Matrix.csv");
  check(rows.length >= 9, "public projection matrix is incomplete");
  for (const row of rows) {
    check(row.serverEligibility.length > 0, `projection lacks server eligibility: ${row.projectionId}`);
    check(
      /private|account|object|moderation|location|participant/iu.test(row.excludedFields),
      `projection lacks explicit exclusions: ${row.projectionId}`,
    );
  }
});

run("shelf-strategy", () => {
  const rows = readCsv("Project_Homeport_Phase_4_Shelf_Strategy_Matrix.csv");
  for (const id of [
    "FEATURED",
    "RECENTLY_LAUNCHED",
    "RECENTLY_UPDATED",
    "DISTRICT_DIRECTORY",
    "DISTRICT_CONTENT",
    "SEARCH_RESULTS",
  ])
    check(
      rows.some((row) => row.shelfId === id),
      `missing governed shelf: ${id}`,
    );
  for (const row of rows) {
    check(Number(row.limit) > 0 && Number(row.limit) <= 48, `unbounded shelf: ${row.shelfId}`);
    check(Boolean(row.deduplication), `shelf lacks deduplication: ${row.shelfId}`);
    check(Boolean(row.emptyBehavior), `shelf lacks empty behavior: ${row.shelfId}`);
  }
});

run("search-filter", () => {
  const contract = readJson("Project_Homeport_Phase_4_Search_and_Filter_Contract.json");
  check(contract.implementationStatus === "BRANCH_VALIDATED_NOT_MERGED", "search contract is not branch validated");
  check(contract.route === "/community" && contract.api === "/api/community/discover", "search route/API mismatch");
  check(contract.history === "PUSH_ON_COMMIT" && contract.backForwardRestores, "search history contract incomplete");
  check(contract.staleRequestPolicy === "ABORT_AND_GENERATION_GUARD", "stale search rejection is not governed");
  check(contract.serverPrivacyFiltering, "search privacy filtering is not server-side");
  check(
    contract.states.includes("NO_RESULTS") && contract.states.includes("DEPENDENCY_UNAVAILABLE"),
    "search states incomplete",
  );
});

run("district-state", () => {
  const rows = readCsv("Project_Homeport_Phase_4_District_State_Matrix.csv");
  check(rows.length === 12, "district-state matrix must cover every governed district");
  for (const row of rows)
    for (const field of [
      "defaultState",
      "emptyState",
      "loadingState",
      "errorState",
      "dependencyUnavailable",
      "partialMediaFailure",
      "primaryRecovery",
    ])
      check(Boolean(row[field]), `district state ${row.districtId} lacks ${field}`);
});

run("mutation-state", () => {
  const rows = readCsv("Project_Homeport_Phase_4_Mutation_State_Matrix.csv");
  for (const mutation of ["SAVE", "UNSAVE", "FOLLOW_CREATOR", "UNFOLLOW_CREATOR", "OPEN_INSTALL_REMIX"])
    check(
      rows.some((row) => row.mutation === mutation),
      `missing mutation state: ${mutation}`,
    );
  for (const row of rows)
    for (const field of ["anonymous", "pending", "success", "failure", "denied"])
      check(Boolean(row[field]), `mutation ${row.mutation} lacks ${field}`);
});

run("parity", () => {
  const registry = readJson("Project_Homeport_Phase_4_District_Registry.json");
  const rows = readCsv("Project_Homeport_Phase_4_Desktop_Mobile_Parity_Matrix.csv");
  for (const district of registry.districts.filter((entry) => entry.visibleEntry))
    check(
      rows.some((row) => row.routeOrAction === district.route),
      `missing desktop/mobile parity row: ${district.id}`,
    );
  check(
    rows.some((row) => /search/iu.test(row.functionalId)),
    "search parity is missing",
  );
  check(
    rows.some((row) => /filter/iu.test(row.functionalId)),
    "filter parity is missing",
  );
});

run("all", () => {});
if (scope === "all") {
  const contracts = readJson("contracts.json", path.join(root, "testing"));
  for (const id of requiredContracts)
    check(
      contracts.contracts.some((contract) => contract.id === id),
      `missing Sounding Line contract: ${id}`,
    );
  const journeys = readJson("Homeport_Journey_Catalog.json").journeys.filter((journey) =>
    journey.journeyId.startsWith("HP-P4-JRN-"),
  );
  check(
    journeys.length === 44 && unique(journeys.map((journey) => journey.journeyId)),
    "Phase 4 journey catalog must contain 44 unique journeys",
  );
  check(
    journeys.every((journey) => journey.result === "PASSED"),
    "Phase 4 journey catalog is not final",
  );
  const metadata = readJson("Project_Homeport_Phase_4_Evidence_Metadata.json", evidenceRoot);
  check(metadata.records.length >= requiredEvidence.length, "Phase 4 evidence metadata is incomplete");
  for (const id of requiredEvidence) {
    const record = metadata.records.find((entry) => entry.evidenceId === id);
    check(Boolean(record), `missing required Phase 4 evidence: ${id}`);
    if (!record) continue;
    const absolute = path.join(root, record.screenshotPath);
    check(existsSync(absolute), `missing Phase 4 screenshot file: ${id}`);
    if (existsSync(absolute))
      check(
        createHash("sha256").update(readFileSync(absolute)).digest("hex") === record.sha256,
        `screenshot digest mismatch: ${id}`,
      );
    check(record.sourceSha === metadata.sourceSha, `evidence source mismatch: ${id}`);
    check(record.reviewerClassification === "CODEX_VISUAL_REVIEW_ACCEPTED", `visual review not accepted: ${id}`);
  }
  const active = readJson("active-test-registry.json", path.join(root, "testing", "generated")).cases;
  const phase4Tests = active.filter(
    (definition) =>
      definition.sourcePaths.some((sourcePath) => /phase4|community/iu.test(sourcePath)) &&
      definition.contracts.some((id) => id.startsWith("homeport.community.")),
  );
  check(phase4Tests.length > 0, "no authoritative Phase 4 test definitions were generated");
  for (const definition of phase4Tests)
    for (const field of [
      "id",
      "owner",
      "contracts",
      "tier",
      "risk",
      "sourcePaths",
      "fixture",
      "databaseOwnership",
      "browserOwnership",
      "portOwnership",
      "expectedDurationMs",
      "retryPolicy",
      "releaseRelevance",
    ])
      check(
        definition[field] !== undefined && definition[field] !== null && definition[field] !== "",
        `authoritative test ${definition.id} lacks ${field}`,
      );
  const ledger = readCsv("Homeport_Nonconformity_Ledger.csv");
  for (const id of ["HP-NC-011", "HP-NC-012", "HP-NC-013", "HP-NC-026"])
    check(
      ledger.find((row) => row.id === id)?.disposition === "CLOSED_PHASE_4_BRANCH_VALIDATED",
      `missing direct Phase 4 disposition: ${id}`,
    );
  for (const id of ["HP-NC-014", "HP-NC-018", "HP-NC-019"])
    check(
      ledger.find((row) => row.id === id)?.disposition === "PARTIAL_PHASE_4_LATER_OWNER_RETAINED",
      `missing exact Phase 4 advancement: ${id}`,
    );
}

if (errors.length) {
  process.stderr.write(
    `PROJECT_HOMEPORT_PHASE4_VALIDATION_FAILED (${scope})\n${errors.map((error) => `- ${error}`).join("\n")}\n`,
  );
  process.exitCode = 1;
} else process.stdout.write(`PROJECT_HOMEPORT_PHASE4_VALIDATION_PASS (${scope})\n`);
