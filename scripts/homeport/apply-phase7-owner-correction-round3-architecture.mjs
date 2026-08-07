import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  evidenceIds,
  findingArea,
  round3Baseline,
  round3Decisions,
  round3Findings,
  round3Fixture,
} from "./phase7-owner-correction-round3-model.mjs";

const root = process.cwd();
const docs = resolve(root, "Development_Docs", "Projects", "Project_Homeport");

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
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
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

if (round3Findings.length !== 54 || round3Decisions.length !== 42 || evidenceIds.length !== 30)
  throw new Error("Round 3 architecture model is incomplete");

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

const ownerRows = round3Findings.map((wording, offset) => {
  const index = offset + 1;
  const [area, severity, owner, contract, tests, evidence] = findingArea(index);
  return {
    finding_id: `HP-OWCR3-${String(index).padStart(3, "0")}`,
    owner_order: index,
    owner_wording: wording,
    product_area: area,
    severity,
    canonical_owner: owner,
    parent_nonconformity: "",
    correction_nonconformity: `HP-NC-${String(index + 156).padStart(3, "0")}`,
    architecture_contract: contract,
    planned_test_contracts: tests,
    planned_evidence_ids: evidence,
    current_status: "ARCHITECTURE_FROZEN_IMPLEMENTATION_PENDING",
    limitation:
      "Architecture freeze only; implementation, live-provider delivery, evidence acceptance, Sounding Line, publication, owner re-review, merge, and deployment remain unproven.",
  };
});

const acceptanceRows = ownerRows.map((row, offset) => ({
  finding_id: row.finding_id,
  acceptance_id: `HP-OWCR3-AC-${String(offset + 1).padStart(3, "0")}`,
  acceptance_criterion: `Exact-source proof satisfies the owner requirement: ${row.owner_wording}`,
  source_authority: row.architecture_contract,
  planned_source_locations: "PENDING_POST_FREEZE_SOURCE_CENSUS",
  required_tests: row.planned_test_contracts,
  required_evidence: row.planned_evidence_ids,
  final_status: "PLANNED",
  limitation: row.limitation,
}));

write("Project_Homeport_Phase_7_Owner_Feedback_Round_3_Ledger.csv", csv(ownerHeader, ownerRows));
write("Project_Homeport_Phase_7_Correction_Round_3_Acceptance_Matrix.csv", csv(acceptanceHeader, acceptanceRows));

const ncPath = resolve(docs, "Homeport_Nonconformity_Ledger.csv");
const nc = parseCsv(readFileSync(ncPath, "utf8"));
const newIds = new Set(ownerRows.map((row) => row.correction_nonconformity));
const retainedNc = nc.rows.filter((row) => !newIds.has(row.id));
const round3Nc = ownerRows.map((row, offset) => ({
  id: row.correction_nonconformity,
  parent_id: "",
  severity: row.severity,
  product_area: row.product_area,
  title: row.owner_wording,
  description: `Owner re-review after Correction Round 2 ${row.finding_id}: ${row.owner_wording}`,
  current_status: "ARCHITECTURE_FROZEN_IMPLEMENTATION_PENDING",
  source_routes: "PENDING_POST_FREEZE_SOURCE_CENSUS",
  source_screens: row.product_area,
  journeys: "HP-OWCR3-JRN-PENDING",
  reproduction_steps: "Reproduce through the owner-observed ordinary path preserved in the Round 3 ledger.",
  observed_result: row.owner_wording,
  expected_governing_result: acceptanceRows[offset].acceptance_criterion,
  evidence_ids: row.planned_evidence_ids,
  root_cause_hypothesis: "Post-freeze source and behavior census pending.",
  canonical_owner: row.canonical_owner,
  integration_owner: "project-homeport",
  target_phase: "PHASE_7_OWNER_CORRECTION_ROUND_3",
  acceptance_contract: acceptanceRows[offset].acceptance_id,
  test_ids: row.planned_test_contracts,
  security_or_privacy_impact:
    row.product_area === "Transactional email" || row.product_area === "Profile imagery" ? "high" : "moderate",
  mobile_impact: [
    "Profile imagery",
    "Profile Overview",
    "Transactional email",
    "Workspace access",
    "Route transition",
  ].includes(row.product_area)
    ? "high"
    : "moderate",
  accessibility_impact: ["Profile imagery", "Transactional email", "Route transition", "Account dropdown"].includes(
    row.product_area,
  )
    ? "high"
    : "moderate",
  dependencies: row.architecture_contract,
  disposition: "ROUND_3_CORRECTION_REQUIRED",
  notes:
    "Round 1 was returned; re-reviews after Rounds 1 and 2 were rejected with actionable findings; Round 3 remains PENDING_OWNER_DECISION.",
}));
writeFileSync(ncPath, csv(nc.header, [...retainedNc, ...round3Nc]), "utf8");

const decisionRows = round3Decisions
  .map(([name, contract], index) => `| ${index + 1} | ${name} | ${contract} |`)
  .join("\n");
write(
  "Project_Homeport_Phase_7_Owner_Walkthrough_Correction_Round_3_Architecture.md",
  frontmatter(
    "Project Homeport Phase 7 Owner Walkthrough Correction Round 3 Architecture",
    "project-homeport-phase-7-owner-walkthrough-correction-round-3-architecture",
    `# Project Homeport Phase 7 owner walkthrough correction Round 3 architecture

## Frozen status boundary

This is Phase 7 correction work, not Phase 8. Independent owner history is preserved:

- Owner Walkthrough Round 1: \`OWNER_RETURNED_FOR_CORRECTION\`
- Owner Re-Review after Round 1: \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`
- Owner Re-Review after Round 2: \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`
- Owner Re-Review Round 3: \`PENDING_OWNER_DECISION\`

The highest automated status is \`PROJECT HOMEPORT PHASE 7 OWNER WALKTHROUGH CORRECTION ROUND 3 READY FOR OWNER RE-REVIEW\`. Automation, Codex visual review, Resend receipts, Sounding Line, publication, or a healthy runtime cannot choose the owner decision.

## Frozen source and isolation boundary

| Field | Frozen value |
| --- | --- |
| Round 2 publication / Round 3 start | \`${round3Baseline}\` |
| Branch | \`codex/project-homeport-product-reality-recovery\` |
| Worktree | \`C:\\Users\\kkids\\Documents\\Codex_TreasureHunt-homeport\` |
| Local, tracking, advertised remote | exact equality at start; divergence \`0/0\` |
| Current origin/main relevance | no main-only commits after fetch |
| Canonical database SHA-256 | \`54647911f63c6a55e5c6b6c95e5ec0a2977b4580a42de073c8c503a3d8c7a412\` |
| Round 3 task root | \`C:\\Users\\kkids\\AppData\\Local\\ProjectHomeport\\phase7-owner-correction-round3-019fd522-78ff-7e41-a3f4-98695fac9bde\` |
| Task-owned ports | \`3761\`-\`3768\` |
| Required fixture | \`${round3Fixture}\` |
| Selected real email provider | Resend; synthetic adapter retained; Postmark compatibility dormant |

The preserved Round 2 owner database, media, credential handoff, evidence, and runtime root are historical records and forbidden as mutation seeds. The governed Round 2 process was stopped without deleting its root. Every mutation-bearing validation uses a purpose-specific Round 3 clone. The canonical database is forbidden.

## Preserved architecture and explicit non-goals

AccountSession, one current-user context, safe return, account claim, ProductShell, navigation families, Personal Information Display Name authority, Public Profile identity, server-enforced privacy, Community aggregates/reviews, delayed loading, zero-orphan navigation, Experience Images, Lanternwake/platform motion, Sealed Hold, and previous Phase 1-7 contracts remain authoritative.

Round 3 does not create Phase 8, redesign Light Mode, replace Sealed Hold, create another asset or identity system, create workspace-specific accounts, grant unrelated resource authority, weaken Chronicle safety, create another route-transition or animation runtime, expose originals/secrets/codes, merge main, open a PR, deploy, or claim owner acceptance.

## Frozen decisions

| # | Decision | Frozen contract |
| --: | --- | --- |
${decisionRows}

## Schema authorization

The existing ProfileMedia, AccountToken, AccountEmail, delivery, preference, role, and Chronicle membership structures must be censused before edits. Additive fields/tables are authorized only where the 42 decisions cannot be represented safely. Crop metadata is normalized, verification material is hashed and bounded, originals/derivatives have explicit lifecycle states, and provider receipts contain no raw secrets. SQLite and MySQL require equivalent fresh and populated migration rehearsals.

## Provider truth boundary

Resend is the selected real provider and its credentials remain only in ignored server-local configuration. Synthetic proof remains separate. Provider acceptance alone is not inbox proof; live email verification requires a real message to arrive and its six-digit code to activate the disposable account. Resend webhook implementation and deployment are deferred.

## Architecture exit condition

This commit freezes authority, ownership, lifecycles, security, traceability, test intent, provider truth, and rollback. It establishes no implementation, migration result, test pass, capture acceptance, Sounding Line decision, publication, live inbox delivery, runtime readiness, owner decision, merge, PR, or deployment.
`,
  ),
);

const contracts = [
  [
    "Project_Homeport_Profile_Imagery_and_Crop_Contract.md",
    "Project Homeport Profile Imagery and Crop Contract",
    "project-homeport-profile-imagery-crop-contract",
    "Profile avatar and banner selection, editing, storage, processing, delivery, replacement, and removal.",
    [
      "PROFILE_AVATAR and PROFILE_BANNER belong to one account-owned Profile and retain owner account/Profile, private original, normalized derivative, active version, dimensions, MIME, bytes, checksum, normalized crop, orientation, timestamps, processing/scan/replacement/removal state.",
      "Selection creates a temporary local preview and exact aspect/mask editor before upload; pan, zoom, wheel/pinch where appropriate, keyboard position and zoom, reset, replace, cancel, save, and removal are available.",
      "PNG, JPEG, and WebP are decoded and bounded by bytes, dimensions, and pixels; extension is not trusted, malformed or unintended animated input fails closed, and derivative metadata is stripped.",
      "Confirmed originals remain private. Only READY server-generated derivatives may become active or be delivered through Profile visibility; a failed replacement leaves the prior media intact.",
      "Object URLs are revoked on replacement, cancel, unmount, success, or terminal failure. Raw object URLs and original filenames are never storage identity.",
    ],
    [
      "crop geometry and deterministic derivative units",
      "upload validation and ownership API tests",
      "replacement/removal failure tests",
      "desktop/mobile/zoom/accessibility editor journeys",
    ],
  ],
  [
    "Project_Homeport_Profile_Identity_Presentation_Contract.md",
    "Project Homeport Profile Identity Presentation Contract",
    "project-homeport-profile-identity-presentation-contract",
    "Canonical Profile identity composition across Personal Harbor, account controls, and authorized public projections.",
    [
      "The Personal Harbor Profile Overview leads with a banner/avatar identity hero, display name, handle state, and biography rather than a completion score.",
      "A missing handle receives a modest direct reminder; a large completion percentage or progress bar is forbidden.",
      "Saved avatar derivatives propagate through the canonical current-user/public projection to the shell account trigger, open account menu, and Community identity surfaces.",
      "Initials render only when no authorized avatar exists; broken, pending, quarantined, removed, or private media never leaks.",
    ],
    [
      "projection allowlist tests",
      "Profile Overview component tests",
      "avatar propagation journeys",
      "privacy and broken-media fallback",
    ],
  ],
  [
    "Project_Homeport_Registration_Email_Code_Verification_Contract.md",
    "Project Homeport Registration Email Code Verification Contract",
    "project-homeport-registration-email-code-verification-contract",
    "Registration-to-verification lifecycle for a pending ordinary account.",
    [
      "Registration creates a pending account and a server-scoped verification challenge, then navigates to a six-digit code screen instead of treating the account as fully ready.",
      "Six random digits are hashed at rest, expire, rotate on resend, are single-use, and enforce bounded attempts and resend rate limits without leaking account existence or codes.",
      "Invalid, expired, rate-limited, unavailable, resend-available, verifying, and verified states are distinct and accessible; verification activates the account and reconciles ordinary workspace entry atomically.",
      "Verification codes never enter logs, committed evidence, database receipts, URLs, analytics, or provider metadata.",
    ],
    [
      "registration/code service units",
      "API rate/attempt/expiry/replay tests",
      "synthetic delivery flow",
      "desktop/mobile invalid/success journeys",
    ],
  ],
  [
    "Project_Homeport_Resend_Transactional_Email_Contract.md",
    "Project Homeport Resend Transactional Email Contract",
    "project-homeport-resend-transactional-email-contract",
    "Provider-neutral transactional delivery with Resend as the selected real provider and a task-owned synthetic adapter.",
    [
      "One delivery port serves verification, password reset, email change, email-change notice, and security notice; production never silently discards a required delivery.",
      "Resend configuration requires a server-only API key, verified sending domain/address, and sender name. Typed text and HTML models exclude secrets from metadata and logs.",
      "Successful submissions persist the provider email ID and secret-safe status for correlation. Provider failures are classified without exposing token, sender internals, recipient, code, reset token, or body.",
      "Resend webhook implementation and deployment are explicitly deferred. The dormant Postmark webhook endpoint is compatibility-only and does not establish Resend event processing.",
      "The synthetic adapter writes only inside HOMEPORT_PHASE7_TASK_ROOT and proves application behavior, not external delivery. Live proof requires provider submission, real inbox receipt, and correlated evidence.",
      "Implementation follows current official Resend documentation for [sending email](https://resend.com/docs/api-reference/emails/send-email), [API keys](https://resend.com/docs/dashboard/api-keys/introduction), and [domains](https://resend.com/docs/dashboard/domains/introduction).",
    ],
    [
      "adapter contract tests",
      "synthetic outbox isolation/privacy",
      "Resend mocked response/error tests",
      "Postmark compatibility regression tests; Resend webhooks deferred",
      "optional configured real-inbox verification",
    ],
  ],
  [
    "Project_Homeport_Workspace_Entry_and_Resource_Authority_Contract.md",
    "Project Homeport Workspace Entry and Resource Authority Contract",
    "project-homeport-workspace-entry-resource-authority-contract",
    "Ordinary workspace entry, empty states, resource-specific authorization, reconciliation, and Chronicle transition safety.",
    [
      "Active claimed verified ordinary accounts can enter Player, Captain, and Creator through one AccountSession without self-activating a second identity.",
      "Entry is not ownership or edit authority: Captain/Creator operations still require their canonical Voyage, Chronicle, draft, publication, or organization grants; no Moderator/Admin or unrelated resource grant is synthesized.",
      "Captain renders a useful empty library when no authorized Voyages exist. Creator renders a useful empty library with its authorized create action.",
      "New-account activation provisions entry atomically. Existing-account dry-run/commit reconciliation is auditable, repeat-safe, and skips restricted, unclaimed, or unverified accounts.",
      "The active-Chronicle lock derives only from authoritative active non-preview Player membership, exposes return/leave recovery, blocks transition only when true, and never substitutes for missing capability.",
    ],
    [
      "entry versus resource IDOR matrix",
      "new-account provisioning",
      "reconciliation dry-run/commit/repeat",
      "empty workspace journeys",
      "true/false lock variants",
    ],
  ],
  [
    "Project_Homeport_Route_Crossfade_Transition_Contract.md",
    "Project Homeport Route Crossfade Transition Contract",
    "project-homeport-route-crossfade-transition-contract",
    "Direct page-to-page crossfade inside a stable ProductShell.",
    [
      "One platform RouteMotionBoundary overlaps outgoing and incoming page layers; the incoming layer becomes visible before the outgoing layer reaches zero opacity.",
      "No frame may show only the shell background during an ordinary transition. ProductShell, global navigation, account controls, and footer remain stable.",
      "Request loading is independent and appears only after the existing 500 ms delay; fast routes show no loading and slow routes do not introduce a blank intermediary.",
      "Focus, scroll, pointer ownership, cleanup, abort/replacement, back/forward, and reduced motion are deterministic and accessible.",
    ],
    [
      "frame-sequence opacity/coverage proof",
      "fast/499/500/501 ms integration",
      "focus/scroll/back-forward tests",
      "cross-product desktop/mobile/reduced-motion journeys",
    ],
  ],
  [
    "Project_Homeport_Account_Menu_Motion_Contract.md",
    "Project Homeport Account Menu Motion Contract",
    "project-homeport-account-menu-motion-contract",
    "Perceptible production account disclosure motion owned by ProductShell and platform motion tokens.",
    [
      "Opening and closing both use perceptible opacity, translation, scale, and material/depth change without moving the trigger or surrounding shell geometry.",
      "The real disclosure DOM is measured; frame evidence includes closed/opening/open/closing/closed computed style and geometry rather than an isolated simulator.",
      "Escape, outside pointer, navigation, focus trap/return, interruption, repeated toggles, and unmount clean up safely.",
      "Reduced motion removes spatial travel and long fades while retaining immediate state and focus equivalence.",
    ],
    [
      "production component tests",
      "opening/closing frame sequence",
      "focus/keyboard/pointer interaction",
      "reduced-motion proof",
    ],
  ],
  [
    "Project_Homeport_Dark_Default_and_Light_Deferral_Contract.md",
    "Project Homeport Dark Default and Light Deferral Contract",
    "project-homeport-dark-default-light-deferral-contract",
    "Deterministic Dark defaults while preserving explicit preferences and deferring broad Light polish.",
    [
      "Anonymous first paint, missing preference, new account, new Profile preference, and Round 3 owner fixture resolve to DARK before interactive paint.",
      "An explicit stored DARK, LIGHT, or SYSTEM choice remains canonical; existing user intent is not overwritten by the new default.",
      "Cross-tab reconciliation and hydration remain stable. No wrong-theme flash or dependence on operating-system Light preference is allowed for a missing preference.",
      "Light Mode remains available as previously implemented, but broad redesign and unrelated Light polish are explicitly deferred from Round 3.",
    ],
    [
      "bootstrap/default units",
      "anonymous/new-account first paint",
      "stored-choice persistence",
      "owner-fixture preflight",
    ],
  ],
];

for (const [file, title, canonical, scope, requirements, verification] of contracts) {
  write(
    file,
    frontmatter(
      title,
      canonical,
      `# ${title}\n\n## Scope\n\n${scope}\n\n## Required behavior\n\n${requirements.map((item) => `- ${item}`).join("\n")}\n\n## Verification\n\n${verification.map((item) => `- ${item}`).join("\n")}\n\n## Truth boundary\n\nThis architecture contract does not prove implementation, migration, live inbox delivery, evidence acceptance, Sounding Line authority, publication, owner acceptance, merge, PR, or deployment.\n`,
    ),
  );
}

write(
  "Project_Homeport_Phase_7_Correction_Round_3_Test_Plan.md",
  frontmatter(
    "Project Homeport Phase 7 Correction Round 3 Test Plan",
    "project-homeport-phase-7-correction-round-3-test-plan",
    `# Project Homeport Phase 7 correction Round 3 test plan

## Isolation and exact source

Use fixture \`${round3Fixture}\`, a new immutable seed, purpose-specific browser/destructive databases, task-owned media and synthetic outbox, ports 3761-3768, independent browser profiles, and source-bound receipts under the Round 3 task root. The canonical database and preserved Round 1/Round 2 owner databases are forbidden. Any source change invalidates prior exact-source evidence.

## Focused gates

- All 54 ledger rows, 42 architecture decisions, contract docs, screen/control/journey/catalog updates, and traceability.
- Profile crop geometry, client preview cleanup, bytes/MIME/decode/pixel/animation validation, private original and derivative lifecycle, replacement atomicity, ownership/visibility IDOR, mobile/touch/keyboard/zoom.
- Registration six-digit challenge state, hash/expiry/attempt/resend/replay/concurrency/rate limits, pending-to-active activation, provider-neutral delivery, synthetic isolation, Resend response/error handling, and retained Postmark compatibility.
- Dark anonymous/new-account/fixture first paint and stored-choice preservation without broad Light redesign.
- Workspace entry versus resource authority, new-account provisioning, existing-account reconciliation, useful Captain/Creator empty states, real active-lock and false-lock cases.
- Direct overlapping crossfade, no background-only frame, stable ProductShell, 499/500/501 ms loading integration, focus/scroll/back-forward/interruption, and reduced motion.
- Production account menu opening and closing frame/computed-style evidence plus focus and cleanup.

## Journey and evidence gates

Run new Round 3 journeys A-V, retained Round 2 A-W, Round 1 A-U, and original Phase 7 A-O against the exact new source. Capture all evidence IDs A-AD. Crop and motion evidence requires frame sequences or bounded video plus computed geometry/styles; a static screenshot cannot prove temporal behavior. Real email evidence requires configured Resend, provider acceptance, owner-confirmed inbox receipt, and successful code consumption; it must never be inferred from synthetic output.

## Aggregate and publication gates

Run focused unit/API/service/component suites, SQLite and MySQL fresh/populated migrations if schema changes, zero-orphan, surface/state catalogs, accessibility, responsive/zoom/touch, privacy/security, docs, feature catalog, language, format, TypeScript, ESLint, production build, Experience Images, updater idempotence, Sounding Line subsystem/mainline, staged-diff privacy, exact-publication authority reruns, remote parity, canonical database invariance, and final owner-runtime health. Only exact-source Sounding Line \`RELEASE_GO\` may authorize publication; it cannot choose the owner decision.
`,
  ),
);

const pendingDocs = [
  [
    "Project_Homeport_Phase_7_Correction_Round_3_Implementation_Report.md",
    "Project Homeport Phase 7 Correction Round 3 Implementation Report",
    "project-homeport-phase-7-correction-round-3-implementation-report",
    "Implementation is pending the architecture commit and post-freeze source census.",
  ],
  [
    "Project_Homeport_Phase_7_Correction_Round_3_Validation_Record.md",
    "Project Homeport Phase 7 Correction Round 3 Validation Record",
    "project-homeport-phase-7-correction-round-3-validation-record",
    "Validation is pending implementation and cannot reuse stale Round 1 or Round 2 evidence.",
  ],
  [
    "Project_Homeport_Phase_7_Correction_Round_3_Integration_Manifest.md",
    "Project Homeport Phase 7 Correction Round 3 Integration Manifest",
    "project-homeport-phase-7-correction-round-3-integration-manifest",
    "Integration and publication are pending exact-source Sounding Line authority.",
  ],
];
for (const [file, title, canonical, state] of pendingDocs)
  write(
    file,
    frontmatter(
      title,
      canonical,
      `# ${title}\n\n## Current state\n\n${state}\n\nRound 1 is \`OWNER_RETURNED_FOR_CORRECTION\`; re-reviews after Rounds 1 and 2 are \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`; Round 3 is \`PENDING_OWNER_DECISION\`. No readiness, live provider proof, owner acceptance, merge, PR, or deployment is claimed.\n`,
    ),
  );

write(
  "evidence/phase7-owner-correction-round3/README.md",
  frontmatter(
    "Project Homeport Phase 7 Owner Correction Round 3 Evidence Index",
    "project-homeport-phase-7-owner-correction-round-3-evidence-index",
    "# Phase 7 owner correction Round 3 evidence\n\nThis directory is architecture-scaffolded for exact-source evidence `HP-OWCR3-EV-A` through `HP-OWCR3-EV-AD`. Captures do not yet exist. Motion and crop interaction need temporal/geometry evidence. Synthetic delivery never proves real inbox delivery, and Codex review never constitutes owner acceptance.\n",
  ),
);
write(
  "evidence/phase7-owner-correction-round3/Project_Homeport_Phase_7_Correction_Round_3_Visual_Review.md",
  frontmatter(
    "Project Homeport Phase 7 Correction Round 3 Visual Review",
    "project-homeport-phase-7-correction-round-3-visual-review",
    "# Phase 7 correction Round 3 visual review\n\n## Current classification\n\n`PENDING_IMPLEMENTATION_AND_CAPTURE`. Future records must be `ACCEPTED`, `REJECTED_PRODUCT_DEFECT`, `REJECTED_EVIDENCE_DEFECT`, `BLOCKED_EXTERNAL`, or `NOT_APPLICABLE`. Opening/closing and direct crossfade require frame evidence; Codex review is not owner acceptance.\n",
  ),
);
write(
  "evidence/phase7-owner-correction-round3/manifest.json",
  `${JSON.stringify(
    {
      schema: "homeport.phase7.owner-correction-round3.evidence-manifest.v1",
      state: "ARCHITECTURE_FROZEN_IMPLEMENTATION_PENDING",
      baselineSha: round3Baseline,
      sourceSha: null,
      fixtureVersion: round3Fixture,
      transactionalEmail: "RESEND_SELECTED_REAL_PROVIDER",
      requiredEvidenceIds: evidenceIds,
      captures: [],
      ownerDecision: "PENDING_OWNER_DECISION",
      limitation:
        "Architecture scaffold only; no implementation, live email, evidence, or owner result is established.",
    },
    null,
    2,
  )}\n`,
);

upsert(
  "Project_Homeport_Design_Record.md",
  "HOMEPORT_OWNER_CORRECTION_ROUND3_ARCHITECTURE",
  `## Phase 7 owner-walkthrough correction Round 3 architecture amendment

**Decision date:** 2026-08-05. **Round 3 start:** \`${round3Baseline}\`. **Owner re-review after Correction Round 2:** \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`. **Round 3 owner decision:** \`PENDING_OWNER_DECISION\`.

The frozen [Round 3 architecture](Project_Homeport_Phase_7_Owner_Walkthrough_Correction_Round_3_Architecture.md) preserves prior Phase 1-7 authority and defines 42 decisions for Profile crop media, identity propagation, six-digit verification, provider-neutral Resend delivery with dormant Postmark compatibility, Dark defaults, ordinary workspace entry versus resource authority, active-Chronicle truth, direct route crossfade, production account-menu motion, fixtures, migrations, exact-source evidence, Sounding Line, owner runtime, status language, and rollback.

The architecture assigns 54 owner findings to \`HP-OWCR3-001\`-\`054\` and new nonconformities \`HP-NC-157\`-\`210\`. It establishes no implementation, live inbox delivery, migration/test result, visual acceptance, Sounding Line decision, publication, owner readiness, merge, PR, deployment, or owner acceptance.`,
);

upsert(
  "README.md",
  "HOMEPORT_OWNER_CORRECTION_ROUND3",
  `## Phase 7 owner correction Round 3

The owner re-review after Correction Round 2 was \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`. Round 3 is architecture-frozen against 54 findings; implementation and current evidence remain pending, Resend is the selected real provider, synthetic proof remains separate, and the owner Round 3 decision is \`PENDING_OWNER_DECISION\`.

- [Round 3 architecture](Project_Homeport_Phase_7_Owner_Walkthrough_Correction_Round_3_Architecture.md)
- [Round 3 owner ledger](Project_Homeport_Phase_7_Owner_Feedback_Round_3_Ledger.csv)
- [Round 3 acceptance matrix](Project_Homeport_Phase_7_Correction_Round_3_Acceptance_Matrix.csv)
- [Round 3 test plan](Project_Homeport_Phase_7_Correction_Round_3_Test_Plan.md)
- [Round 3 evidence index](evidence/phase7-owner-correction-round3/README.md)

This remains branch-local Phase 7 correction work: not merged, not deployed, not owner accepted, and not live-provider proof.`,
);

console.log(
  JSON.stringify(
    {
      result: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND3_ARCHITECTURE_APPLIED",
      findings: ownerRows.length,
      nonconformities: round3Nc.length,
      decisions: round3Decisions.length,
      evidenceContracts: evidenceIds.length,
    },
    null,
    2,
  ),
);
