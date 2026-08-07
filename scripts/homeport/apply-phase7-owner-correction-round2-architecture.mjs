import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  evidenceIds,
  findingArea,
  round2Baseline,
  round2Decisions,
  round2Findings,
  round2Fixture,
} from "./phase7-owner-correction-round2-model.mjs";

const root = process.cwd();
const docs = resolve(root, "Development_Docs", "Projects", "Project_Homeport");
const evidenceRoot = resolve(docs, "evidence", "phase7-owner-correction-round2");

function q(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function csv(header, rows) {
  return `${header.map(q).join(",")}\n${rows.map((row) => header.map((key) => q(row[key])).join(",")).join("\n")}\n`;
}

function parseCsv(text) {
  const lines = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/u, ""));
      if (row.some(Boolean)) lines.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/u, ""));
    lines.push(row);
  }
  const [header, ...values] = lines;
  return {
    header,
    rows: values.map((entry) => Object.fromEntries(header.map((key, index) => [key, entry[index] ?? ""]))),
  };
}

function write(relative, content) {
  const target = resolve(docs, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content.replaceAll("\r\n", "\n"), "utf8");
}

function frontmatter(title, canonical, body) {
  return `---
title: ${title}
audience: product-engineering
status: current
canonical_for: ${canonical}
last_reviewed: 2026-08-05
---

${body.trim()}\n`;
}

function upsert(relative, marker, content) {
  const target = resolve(docs, relative);
  const start = `<!-- ${marker}:START -->`;
  const end = `<!-- ${marker}:END -->`;
  const block = `${start}\n${content.trim()}\n${end}`;
  let current = readFileSync(target, "utf8").replaceAll("\r\n", "\n");
  const pattern = new RegExp(
    `${start.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`,
    "u",
  );
  current = pattern.test(current) ? current.replace(pattern, block) : `${current.trimEnd()}\n\n${block}\n`;
  writeFileSync(target, current, "utf8");
}

if (round2Findings.length !== 85 || round2Decisions.length !== 35) {
  throw new Error("Round 2 architecture model is incomplete");
}

const ownerHeader = [
  "finding_id",
  "owner_order",
  "owner_wording",
  "product_area",
  "severity",
  "canonical_owner",
  "parent_nonconformity",
  "correction_nonconformity",
  "architecture_contract",
  "planned_test_contracts",
  "planned_evidence_ids",
  "current_status",
  "limitation",
];
const acceptanceHeader = [
  "finding_id",
  "acceptance_id",
  "acceptance_criterion",
  "source_authority",
  "planned_source_locations",
  "required_tests",
  "required_evidence",
  "final_status",
  "limitation",
];

const ownerRows = round2Findings.map((wording, offset) => {
  const index = offset + 1;
  const [area, severity, owner, contract, test, evidence] = findingArea(index);
  const id = `HP-OWCR2-${String(index).padStart(3, "0")}`;
  const nc = `HP-NC-${String(index + 71).padStart(3, "0")}`;
  return {
    finding_id: id,
    owner_order: index,
    owner_wording: wording,
    product_area: area,
    severity,
    canonical_owner: owner,
    parent_nonconformity: "",
    correction_nonconformity: nc,
    architecture_contract: contract,
    planned_test_contracts: test,
    planned_evidence_ids: evidence,
    current_status: "ARCHITECTURE_FROZEN_IMPLEMENTATION_PENDING",
    limitation:
      "No implementation, test result, evidence acceptance, Sounding Line decision, owner re-review, merge, or deployment is established by the architecture freeze.",
  };
});

const acceptanceRows = ownerRows.map((row, offset) => ({
  finding_id: row.finding_id,
  acceptance_id: `HP-OWCR2-AC-${String(offset + 1).padStart(3, "0")}`,
  acceptance_criterion: `Source-bound proof satisfies the owner requirement: ${row.owner_wording}`,
  source_authority: row.architecture_contract,
  planned_source_locations: "PENDING_POST_FREEZE_SOURCE_CENSUS",
  required_tests: row.planned_test_contracts,
  required_evidence: row.planned_evidence_ids,
  final_status: "PLANNED",
  limitation: row.limitation,
}));

write("Project_Homeport_Phase_7_Owner_Feedback_Round_2_Ledger.csv", csv(ownerHeader, ownerRows));
write("Project_Homeport_Phase_7_Correction_Round_2_Acceptance_Matrix.csv", csv(acceptanceHeader, acceptanceRows));

const ncPath = resolve(docs, "Homeport_Nonconformity_Ledger.csv");
const nc = parseCsv(readFileSync(ncPath, "utf8"));
const priorRows = nc.rows.filter(
  (row) => !/^HP-NC-(?:0(?:7[2-9]|8[0-9]|9[0-9])|1(?:[0-4][0-9]|5[0-6]))$/u.test(row.id),
);
const ncRows = ownerRows.map((row, offset) => ({
  id: row.correction_nonconformity,
  parent_id: "",
  severity: row.severity,
  product_area: row.product_area,
  title: row.owner_wording,
  description: `Owner re-review after Correction Round 1 ${row.finding_id}: ${row.owner_wording}`,
  current_status: "ARCHITECTURE_FROZEN_IMPLEMENTATION_PENDING",
  source_routes: "PENDING_POST_FREEZE_SOURCE_CENSUS",
  source_screens: row.product_area,
  journeys: "HP-OWCR2-JRN-PENDING",
  reproduction_steps: "Reproduce through the owner-observed ordinary path recorded in the Round 2 ledger.",
  observed_result: row.owner_wording,
  expected_governing_result: acceptanceRows[offset].acceptance_criterion,
  evidence_ids: row.planned_evidence_ids,
  root_cause_hypothesis: "Post-freeze source and behavior census pending.",
  canonical_owner: row.canonical_owner,
  integration_owner: "project-homeport",
  target_phase: "PHASE_7_OWNER_CORRECTION_ROUND_2",
  acceptance_contract: acceptanceRows[offset].acceptance_id,
  test_ids: row.planned_test_contracts,
  security_or_privacy_impact: offset + 1 >= 67 ? "high" : "moderate",
  mobile_impact: [1, 4, 10, 13, 15, 32, 40, 73].some((start) => offset + 1 >= start) ? "high" : "moderate",
  accessibility_impact: offset + 1 <= 18 || (offset + 1 >= 32 && offset + 1 <= 41) ? "high" : "moderate",
  dependencies: row.architecture_contract,
  disposition: "ROUND_2_CORRECTION_REQUIRED",
  notes:
    "Owner Round 1 was returned; re-review after Correction Round 1 was rejected with actionable findings; Round 2 owner decision remains PENDING_OWNER_DECISION.",
}));
writeFileSync(ncPath, csv(nc.header, [...priorRows, ...ncRows]), "utf8");

const decisionRows = round2Decisions
  .map(([name, contract], index) => `| ${index + 1} | ${name} | ${contract} |`)
  .join("\n");
const architecture = frontmatter(
  "Project Homeport Phase 7 Owner Walkthrough Correction Round 2 Architecture",
  "project-homeport-phase-7-owner-walkthrough-correction-round-2-architecture",
  `# Project Homeport Phase 7 owner walkthrough correction Round 2 architecture

## Frozen status boundary

This is Phase 7 correction work, not Phase 8. The owner completed Correction Round 1 re-review and rejected it with 85 actionable findings. The independent state is preserved:

- Owner Walkthrough Round 1 Decision: \`OWNER_RETURNED_FOR_CORRECTION\`
- Owner Re-Review after Correction Round 1: \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`
- Owner Re-Review Round 2: \`PENDING_OWNER_DECISION\`

The highest automated status this round may reach is \`PROJECT HOMEPORT PHASE 7 OWNER WALKTHROUGH CORRECTION ROUND 2 READY FOR OWNER RE-REVIEW\`. Neither Codex, tests, visual review, nor Sounding Line may choose the owner decision or claim owner acceptance.

## Frozen source and isolation boundary

| Field | Frozen value |
| --- | --- |
| Round 1 publication / Round 2 start | \`${round2Baseline}\` |
| Branch | \`codex/project-homeport-product-reality-recovery\` |
| Worktree | \`C:\\Users\\kkids\\Documents\\Codex_TreasureHunt-homeport\` |
| Fetched local/tracking/advertised state | exact equality at start; divergence \`0/0\` |
| Fetched \`origin/main\` and merge base | \`8d142227d712d27e363b15903dba9b0c99a04bc8\`; no main-only commits |
| Canonical database start hash | \`54647911F63C6A55E5C6B6C95E5EC0A2977B4580A42DE073C8C503A3D8C7A412\` |
| Round 2 task root | \`C:\\Users\\kkids\\AppData\\Local\\ProjectHomeport\\phase7-owner-correction-round2-019fd274-d58b-7d00-ab01-8d68b1a29216\` |
| Task-owned ports | \`3751\`–\`3756\` |
| Required fixture | \`${round2Fixture}\` |

The stopped Round 1 runtime and database remain preserved historical owner evidence. They are forbidden as Round 2 seeds. Every destructive or mutation-bearing validation uses a new purpose-specific clone. The canonical database is forbidden.

## Preserved accepted architecture

Round 2 preserves Phases 1–7 and Correction Round 1: one AccountSession/current-user context; canonical authentication and email/claiming; ProductShell and all navigation families; one Display Name authority and public/private Profile separation; Harborlight public-safe districts/search/Creator Profiles/collections/reviews/saves; zero unexplained ordinary route orphans; source-derived screen/state registries; Preview versus Start; Chronicle aliases; provider adapters; account export/deactivation/deletion; Personal Harbor; delayed loading; route transitions; and Community compact/full search.

No second Profile, review model, save model, completion source, theme framework, route-local loading timer family, unmanaged animation interval, or live-provider claim is authorized. Moderator/Admin are never auto-granted; private completion and Chronicle content remain private. No merge, PR, deployment, Phase 8, or owner acceptance is authorized.

## Frozen decisions

| # | Decision | Frozen contract |
| --: | --- | --- |
${decisionRows}

## Schema authorization gate

The post-freeze census must inspect existing Community saves, reviews, Chronicle completion, public Profile, and preference storage before any schema edit. A schema change requires an exact unmet invariant. Any cache is a rebuildable projection with reconciliation and drift protection. SQLite and MySQL must receive equivalent additive treatment with fresh and populated upgrade rehearsal. Arbitrary card counts or ratings are never source truth.

## Privacy and security gates

Tests must cover save/review IDOR, duplicates, completion forgery, Profile visibility, private handles, return URLs, theme mass assignment, capability escalation, Community error leakage, Experience Images leakage, and synthetic-outbox privacy. No committed evidence may contain credentials, session/email/reset tokens, provider secrets, private Chronicle prose, answers, locations, object keys, or real personal data.

## Architecture exit condition

This commit freezes authority, traceability, contracts, test intent, and rollback only. It establishes no implementation, fixture result, journey result, evidence acceptance, Experience Images completeness, Sounding Line decision, publication, runtime readiness, owner re-review, merge, or deployment.
`,
);
write("Project_Homeport_Phase_7_Owner_Walkthrough_Correction_Round_2_Architecture.md", architecture);

const contracts = [
  [
    "Project_Homeport_Runtime_Fixture_Parity_Contract.md",
    "Project Homeport Runtime Fixture Parity Contract",
    "project-homeport-runtime-fixture-parity-contract",
    "Runtime fixture parity",
    [
      "One canonical builder supplies automated aliases and final owner-runtime aliases.",
      "Synthetic Sera is claimed, active, verified-email, public-Profile configured, unrestricted, and three-workspace capable with no active Chronicle.",
      "Preparation validates roles, account/email/Profile/Community/provider state and fails closed before server start.",
      "Capability reconciliation supports dry-run and commit, emits an audit record, is duplicate-safe, and never grants resource-specific or privileged authority.",
    ],
    [
      "Fixture checksum and database hash",
      "dry-run/commit/repeat reconciliation",
      "final runtime preflight",
      "actual Captain/Creator ordinary navigation",
    ],
  ],
  [
    "Project_Homeport_Global_Theme_and_Visual_Token_Contract.md",
    "Project Homeport Global Theme and Visual Token Contract",
    "project-homeport-global-theme-visual-token-contract",
    "Dark, Light, and System",
    [
      "One semantic token architecture owns surfaces, borders, text roles, controls, states, focus, and shadows.",
      "Dark and Light cover every human surface without mixed-mode cards; System follows the OS until explicit override.",
      "Explicit choice persists, reconciles across tabs, and applies before first paint without hydration mismatch.",
      "Body, inactive, metadata, secondary, heading, and disabled text remain distinct and meet governed contrast.",
    ],
    [
      "token census",
      "automated contrast",
      "first-paint/theme persistence/cross-tab browser tests",
      "desktop/mobile human visual review",
    ],
  ],
  [
    "Project_Homeport_Home_Ambient_and_Role_Card_Motion_Contract.md",
    "Project Homeport Home Ambient and Role Card Motion Contract",
    "project-homeport-home-ambient-role-card-motion-contract",
    "Structural stability and physical ambient motion",
    [
      "Static layout owns role-icon position through SSR, hydration, hover, focus, press, remount, mobile, and reduced motion.",
      "Menu motion is visibly rendered with opacity, 6–10 px travel, scale, 150–200 ms timing, reversible close, and focus safety.",
      "Lantern rotates about the physical pivot through a balanced arc; stars visibly twinkle; fog drifts coherently.",
      "Visibility pauses work and reduced motion yields complete static or near-immediate states.",
    ],
    [
      "bounding-box frame sequence",
      "computed opacity/transform sequence",
      "lantern neutral/left/right geometry",
      "hidden/reduced-motion lifecycle",
    ],
  ],
  [
    "Project_Homeport_Community_Loading_State_Contract.md",
    "Project Homeport Community Loading State Contract",
    "project-homeport-community-loading-state-contract",
    "Community request truth",
    [
      "One request boundary distinguishes pending, delayed loading, success, empty, real failure, retry, stale, and aborted states.",
      "Success before 500 ms shows neither loading nor error; slower success shows loading only after 500 ms.",
      "Only a real failure or governed timeout renders error; retry preserves context and settles exactly once.",
      "All districts are proven through ordinary navigation and empty Current Area strips are absent.",
    ],
    [
      "100/499/500/501 ms timing",
      "abort/stale replacement",
      "real failure and retry",
      "district ordinary-navigation matrix",
    ],
  ],
  [
    "Project_Homeport_Public_Profile_and_Community_Identity_Contract.md",
    "Project Homeport Public Profile and Community Identity Contract",
    "project-homeport-public-profile-community-identity-contract",
    "One public identity",
    [
      "Public Profile is the sole visible Community identity; Harborlight consumes only an allowlisted projection.",
      "An existing valid public handle automatically satisfies review identity.",
      "Missing setup links directly to Public Profile with a validated return target and restores the original composer.",
      "Private identity data and hidden handles never enter public projections or evidence.",
    ],
    ["existing Profile happy path", "setup and return", "tampered return target", "visibility/privacy matrix"],
  ],
  [
    "Project_Homeport_Community_Rating_and_Save_Aggregation_Contract.md",
    "Project Homeport Community Rating and Save Aggregation Contract",
    "project-homeport-community-rating-save-aggregation-contract",
    "Authoritative aggregates",
    [
      "Save count derives from unique active save records and changes on save/unsave.",
      "Average and rating count derive from eligible published reviews under the accepted moderation/removal policy.",
      "Duplicate saves and duplicate active ratings do not count; mutations and reconciliation yield the same aggregate.",
      "Zero ratings render an unrated state, never fabricated values or zero stars.",
    ],
    [
      "save/review IDOR and uniqueness",
      "create/update/delete/moderation",
      "aggregate reconciliation",
      "card/detail parity",
    ],
  ],
  [
    "Project_Homeport_Chronicle_Completion_Review_Contract.md",
    "Project Homeport Chronicle Completion Review Contract",
    "project-homeport-chronicle-completion-review-contract",
    "Completion-verified reviews",
    [
      "One Voyage server completion for the exact Chronicle/version is the sole eligibility source.",
      "The optional prompt may be dismissed; eligible review entry remains later in Passport history and public detail.",
      "One active review per account and governed Chronicle/version; edit/remove follows Harborlight policy.",
      "Spoiler controls persist, client claims cannot grant access, and completion details remain private.",
    ],
    ["completion forgery/IDOR", "version mismatch", "prompt dismiss and later entry", "edit/delete/spoiler"],
  ],
  [
    "Project_Homeport_Chronicle_Preview_Expansion_Contract.md",
    "Project Homeport Chronicle Preview Expansion Contract",
    "project-homeport-chronicle-preview-expansion-contract",
    "Public-safe Chronicle preview",
    [
      "Preview remains nonmutating and separate from Start.",
      "The preview adds practical requirements, experiential metadata, authoritative rating/save summary, review/comment summary, and warnings.",
      "Projection is spoiler-aware and excludes private Chronicle truth, answers, and exact locations.",
      "Back/return and Start remain explicit across desktop and mobile.",
    ],
    ["safe projection unit/API", "preview nonmutation", "expanded desktop/mobile visual", "spoiler/privacy scan"],
  ],
  [
    "Project_Homeport_Experience_Images_Contract.md",
    "Project Homeport Experience Images Contract",
    "project-homeport-experience-images-contract",
    "Exact-source product census",
    [
      "Generate only after implementation commit, focused tests, Round 2 journeys, final fixture, complete theme, and exact production build succeed.",
      "Capture every ordinary human page on desktop and every critical/high page on mobile, plus major loading/empty/error/permission/unavailable states and Dark/Light coverage.",
      "Exclude APIs, assets, callbacks, secrets, private content, and real personal data.",
      "Manifest, checksums, route/state census, browseable index, and contact sheets bind to the exact source; zero missing pages is mandatory.",
    ],
    [
      "route/screen census comparison",
      "checksum/source validator",
      "private-content scan",
      "human contact-sheet review",
    ],
  ],
];

for (const [file, title, canonical, scope, requirements, verification] of contracts) {
  write(
    file,
    frontmatter(
      title,
      canonical,
      `# ${title}\n\n## Scope\n\n${scope}. This contract repairs Round 2 realization while preserving specialist domain authority and prior accepted Homeport contracts.\n\n## Required behavior\n\n${requirements.map((item) => `- ${item}`).join("\n")}\n\n## Verification\n\n${verification.map((item) => `- ${item}`).join("\n")}\n\n## Truth boundary\n\nArchitecture freeze records the contract only. Implementation, evidence, Sounding Line release authority, and the owner's independent decision remain pending. No merge, deployment, live-provider proof, or owner acceptance is established.\n`,
    ),
  );
}

write(
  "Project_Homeport_Phase_7_Correction_Round_2_Test_Plan.md",
  frontmatter(
    "Project Homeport Phase 7 Correction Round 2 Test Plan",
    "project-homeport-phase-7-correction-round-2-test-plan",
    `# Project Homeport Phase 7 correction Round 2 test plan

## Isolation and exact source

Use fixture \`${round2Fixture}\`, a new immutable seed, one canonical builder, fresh purpose-specific database clones, task-owned media/outbox/browser profiles, ports 3751–3756, and source-bound receipts. The canonical database and preserved Round 1 owner database are forbidden. Evidence is invalid after any source change.

## Focused contract families

- Round 2 85-row ledger, architecture, fixture parity, capability reconciliation, and final-runtime preflight.
- Role-card bounding boxes; menu frame/computed motion; lantern pivot/symmetry; star/fog lifecycle; reduced motion.
- Dark/Light/System, persistence, cross-tab, no-flash, semantic tokens, automated contrast, zoom, mobile, and accessibility.
- Community 100/499/500/501 ms state machine, real failure/retry/stale/abort, every district, and contextual-strip policy.
- Public Profile identity, setup return, privacy, saves, ratings, duplicates, moderation, reconciliation, and IDOR.
- Chronicle completion/version eligibility, forgery denial, optional/later review, Passport/public entry, edit/remove/spoilers, and expanded preview.
- Synthetic outbox owner method and live-provider truth; Experience Images route/state/theme census, checksums, contact sheets, source binding, and privacy.

## Browser journeys and evidence

Run new Round 2 journeys A–W, then Correction Round 1 A–U and original Phase 7 A–O against the exact new source. Capture all required evidence IDs A–AE. Motion requires frame sequences or bounded video plus computed/bounding-box proof; static screenshots alone are insufficient.

## Aggregate and publication gates

Run all affected unit/API/service/component families, Phase 5 zero-orphan, Phase 6 surface/state, aggregate Homeport validators, docs/catalog/language, formatting, TypeScript, ESLint, privacy, SQLite/MySQL schema and migrations if changed, production build, Experience Images generator/validator, updater twice with byte identity, Sounding Line subsystem and mainline, staged-diff privacy, exact-publication authority reruns, push/parity, canonical database invariance, and final owner-runtime health. Only exact-source \`RELEASE_GO\` decisions count.
`,
  ),
);

const pendingDocs = [
  [
    "Project_Homeport_Phase_7_Correction_Round_2_Implementation_Report.md",
    "Project Homeport Phase 7 Correction Round 2 Implementation Report",
    "project-homeport-phase-7-correction-round-2-implementation-report",
    "Implementation is pending the architecture commit and post-freeze source census.",
  ],
  [
    "Project_Homeport_Phase_7_Correction_Round_2_Validation_Record.md",
    "Project Homeport Phase 7 Correction Round 2 Validation Record",
    "project-homeport-phase-7-correction-round-2-validation-record",
    "Validation is pending implementation and may not reuse stale Round 1 evidence.",
  ],
  [
    "Project_Homeport_Phase_7_Correction_Round_2_Integration_Manifest.md",
    "Project Homeport Phase 7 Correction Round 2 Integration Manifest",
    "project-homeport-phase-7-correction-round-2-integration-manifest",
    "Integration and publication are pending exact-source Sounding Line authority.",
  ],
];
for (const [file, title, canonical, state] of pendingDocs) {
  write(
    file,
    frontmatter(
      title,
      canonical,
      `# ${title}\n\n## Current state\n\n${state}\n\nOwner Walkthrough Round 1 remains \`OWNER_RETURNED_FOR_CORRECTION\`; re-review after Correction Round 1 is \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`; Round 2 remains \`PENDING_OWNER_DECISION\`. No readiness, owner acceptance, merge, PR, deployment, or live-provider proof is claimed.\n`,
    ),
  );
}

write(
  "evidence/phase7-owner-correction-round2/README.md",
  frontmatter(
    "Project Homeport Phase 7 Owner Correction Round 2 Evidence Index",
    "project-homeport-phase-7-owner-correction-round-2-evidence-index",
    `# Phase 7 owner correction Round 2 evidence\n\nThis directory is architecture-scaffolded for exact-source evidence IDs \`HP-OWCR2-EV-A\` through \`HP-OWCR2-EV-AE\`. Captures do not yet exist. Evidence will be generated only after implementation, focused tests, Round 2 journeys, the final fixture, complete theme, and production build pass. Codex visual review will not constitute owner acceptance.\n`,
  ),
);
write(
  "evidence/phase7-owner-correction-round2/Project_Homeport_Phase_7_Correction_Round_2_Visual_Review.md",
  frontmatter(
    "Project Homeport Phase 7 Correction Round 2 Visual Review",
    "project-homeport-phase-7-correction-round-2-visual-review",
    `# Phase 7 correction Round 2 visual review\n\n## Current classification\n\n\`PENDING_IMPLEMENTATION_AND_CAPTURE\`. Every future item must be classified as \`ACCEPTED\`, \`REJECTED_PRODUCT_DEFECT\`, \`REJECTED_EVIDENCE_DEFECT\`, \`BLOCKED_EXTERNAL\`, or \`NOT_APPLICABLE\`. Motion needs frame or bounded-video evidence. Codex review is not owner acceptance.\n`,
  ),
);
write(
  "evidence/phase7-owner-correction-round2/manifest.json",
  `${JSON.stringify(
    {
      schema: "homeport.phase7.owner-correction-round2.evidence-manifest.v1",
      state: "ARCHITECTURE_FROZEN_IMPLEMENTATION_PENDING",
      baselineSha: round2Baseline,
      sourceSha: null,
      fixtureVersion: round2Fixture,
      requiredEvidenceIds: evidenceIds,
      captures: [],
      ownerDecision: "PENDING_OWNER_DECISION",
      limitation: "Architecture scaffold only; no implementation or evidence result is established.",
    },
    null,
    2,
  )}\n`,
);

upsert(
  "Project_Homeport_Design_Record.md",
  "HOMEPORT_OWNER_CORRECTION_ROUND2_ARCHITECTURE",
  `## Phase 7 owner-walkthrough correction Round 2 architecture amendment

**Decision date:** 2026-08-05. **Round 2 start:** \`${round2Baseline}\`. **Owner re-review after Correction Round 1:** \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`. **Round 2 owner decision:** \`PENDING_OWNER_DECISION\`.

The frozen [Round 2 architecture](Project_Homeport_Phase_7_Owner_Walkthrough_Correction_Round_2_Architecture.md) preserves all Phase 1–7 and Correction Round 1 authorities while defining 35 decisions for runtime fixture parity, claimed-account reconciliation, Sera preflight, motion geometry, complete Dark/Light/System themes, semantic contrast tokens, Community request truth, one public Profile identity, authoritative save/rating aggregates, completion-verified reviews, expanded preview, synthetic email truth, Experience Images, Sounding Line, schema authorization, exact source, owner package, status language, and rollback.

The architecture assigns 85 verbatim findings to \`HP-OWCR2-001\`–\`085\` and new nonconformities \`HP-NC-072\`–\`156\`. It establishes no implementation, migration, test result, screenshot acceptance, Sounding Line decision, publication, re-review readiness, merge, deployment, or owner acceptance.`,
);

upsert(
  "README.md",
  "HOMEPORT_OWNER_CORRECTION_ROUND2",
  `## Phase 7 owner correction Round 2

The owner re-review after Correction Round 1 was \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`. Round 2 is architecture-frozen against 85 findings; implementation and current evidence remain pending, and the owner Round 2 decision is \`PENDING_OWNER_DECISION\`.

- [Round 2 architecture](Project_Homeport_Phase_7_Owner_Walkthrough_Correction_Round_2_Architecture.md)
- [Owner feedback Round 2 ledger](Project_Homeport_Phase_7_Owner_Feedback_Round_2_Ledger.csv)
- [Round 2 acceptance matrix](Project_Homeport_Phase_7_Correction_Round_2_Acceptance_Matrix.csv)
- [Round 2 test plan](Project_Homeport_Phase_7_Correction_Round_2_Test_Plan.md)
- [Round 2 evidence index](evidence/phase7-owner-correction-round2/README.md)

This remains branch-local correction work: not merged, not deployed, not owner accepted, and not live-provider proof.`,
);

console.log(
  JSON.stringify(
    {
      result: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND2_ARCHITECTURE_APPLIED",
      findings: ownerRows.length,
      nonconformities: ncRows.length,
      decisions: round2Decisions.length,
      evidenceContracts: evidenceIds.length,
    },
    null,
    2,
  ),
);
