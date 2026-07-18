# Phase B-3 Completion Report

Report date: 2026-07-18

Implementation status: code and automated gate passed
Phase status: **INCOMPLETE — mandatory usability and live Companion demonstration evidence is blocked**

## Summary

B-3 implements the reusable creator-side Vision Waypoint machine: searchable Library, all initial types, twelve-step resumable wizard, real B-2 adapter calls, recording curation, accepted/boundary rules, hard-negative gates, visual-region tooling, Data Health, locked tests, optimistic concurrency, and deterministic BuildInput persistence.

Creators no longer need a terminal, JSON editing, or source changes to author another waypoint. The UI says what is saved, where media lives, and that B-3 creates no recognition model or confidence.

The automated exit gate is green. The overall B-3 exit gate is **not passed** because no three-profile human usability study was performed and no live Sea of Thieves / real Companion authoring demonstration was available. These are recorded as failures, not future enhancements or fabricated passes.

## Repository

- Branch: `codex/phase-b3-studio-authoring`
- Base branch: `origin/codex/phase-b2-native-capture`
- Base commit: `eec2c73146a63d6f061254209fef59ac5d4691a5`
- Implementation commit: `45d9c98f98afe0dcb1e6364c3b0916de10ee9ad6`
- Pull request: none created
- SQLite migration: `20260718140000_vision_studio_authoring_b3`
- MySQL migration: `0007_vision_studio_authoring_b3`

The main checkout and completed B-2 worktree were not modified. Two user-owned untracked PDFs in the main checkout were preserved.

## Architecture

Shared code touched:

- `src/vision/authoring-domain.ts`: strict authoring and geometry contracts;
- `src/vision/authoring.ts`: aggregate composition, health, mutations, BuildInput;
- existing lifecycle/capture persistence: revision, curation, thumbnail, and deletion safety;
- shared Studio React components and `vision.css`;
- three authenticated API route groups;
- SQLite/MySQL Prisma schemas and additive migrations.

Platform operations use the existing `CapturePlatformAdapter`, `DesktopCapturePlatformAdapter`, and `WebCapturePlatformAdapter`. No capture core or frontend was duplicated.

Contract versions:

- Companion protocol: 2.0 (unchanged B-2 authority);
- authoring state: 1;
- BuildInput: 1;
- development package schema: 1 (unchanged B-1 path).

ADR 0014 records the version-owned aggregate, concurrency, normalized children, and deterministic no-model boundary.

## User Experience

Library route: `/studio/vision-waypoints`

Authoring route: `/studio/vision-waypoints/[waypointId]`

Library cards include search, type/status filtering, sorting, usage, version/status, tags, resume/open/use/archive actions, and on-demand real local representative media. Disconnected cards show a truthful Companion requirement rather than a fake thumbnail or reliability score.

Wizard steps:

1. Purpose
2. Story Intent
3. Companion
4. Record Target
5. Accepted Player Area
6. Boundaries
7. Similar Wrong Places
8. Important Visual Regions
9. Data Health
10. Build Preparation
11. Test Plan
12. Review

Guided mode uses plain language. Detailed mode exposes evidence/configuration detail. Engineering mode adds identifiers, schema, revision, hash, and storage facts. All modes share one persisted state.

The region editor provides brush, polygon, rectangle, eraser, undo, redo, reset, copy, visibility, opacity, non-AI layout suggestion, multiple recording sources, and a non-pointer coordinate-list alternative.

Preserved screenshot:

- `Development_Docs/AR/Phase_B3/Evidence/01-studio-region-authoring.png`
- SHA-256: `2765489ACF76CA5BFB0E56C8EA06A582DF590DB82577E43FD32EBE5C3E923DFA`

## Companion Integration

Studio uses B-2 capabilities/status, target enumeration/selection, creator start/pause/resume/stop/cancel, local artifact preview/export/delete, and status/progress events. Stop persists the exact returned managed manifest to the owned draft. Failure copy distinguishes “local file retained” from “Studio manifest saved.”

Desktop and browser render the same component. The transport adapter is selected at runtime; both reach one B-2 coordinator/capture core. Automated parity passes. Live target-game parity remains a blocked demonstration.

## Data

The migration adds:

- version revision/mode/current step;
- asset notes, role, usability, logical ranges/source, integrity, and cloud state;
- build input schema/text/hash;
- test name/instructions/environment/role/lock time.

Accepted pose, visual region, hard-negative, capture, audit, build-artifact, and test-run entities reuse the B-1/B-2 normalized foundation.

BuildInput is recursively key-sorted, record arrays are ID-sorted, and the exact UTF-8 bytes are hashed. It contains hashes/roles/governed metadata but not raw video or arbitrary local paths. Persisted boundary fields are all false for model, confidence, and certification production.

Deletion is rejected when a region, locked test, or prepared build references the recording. Local/cloud and integrity states are visible.

## Tests

Final clean-runtime results:

- 8 migrations passed;
- 36 Vitest files / 111 tests passed;
- 3 desktop bridge tests passed;
- 20 Companion tests passed;
- 32 Playwright tests passed;
- 12 intentional shared-database WebKit mutation skips;
- 0 Playwright failures;
- Axe WCAG 2A/2AA: 0 violations on populated B-3 region authoring;
- accepted database state preserved across `seed --ensure`;
- optimized production build passed;
- production start passed twice;
- desktop packaging for `0.5.0-b3` passed;
- Electron Companion smoke with the actual desktop-capturer adapter and a synthetic harness window passed;
- unsigned packaged executable launch was **blocked** by local Application Control (`spawn UNKNOWN`);
- human usability: **0 participants, blocked**.

See `B3_Test_Plan_and_Results.md` for the matrix and compatibility fixes.

The verified installer SHA-256 was `419ABF898C6E3B625737DE14F69BDDB1603584190B87322350FF736533F1CCCA`; the unpacked executable SHA-256 was `52C0DEA98AD9E16966A6A2B71B1E5A670470B8291C85555878C002CFC9CD9F42`. Generated packaging output was removed after verification.

## Demonstration

Automated demonstrations prove persisted authoring, resume/conflict, immutability, Story-Critical gating, parity, accessible region authoring, deletion safety, BuildInput hash, and the no-model boundary.

Required live demonstrations A–C remain blocked because Sea of Thieves was installed but not running and no coordinated game/account/Companion session was available. Demonstration D immutability passes automatically. `B3_Demonstration.md` contains the exact status and rerun outline.

## Blocking unfinished evidence

These are mandatory B-3 items, not accepted later-phase limitations:

1. Observe and record usability with the required three human profiles, fix major failures, and rerun affected tasks.
2. Run Exact Landmark creation against a real Sea of Thieves window and B-2 Companion, including multiple target views, accepted/boundary recordings, two wrong locations, warning correction, build submission, and Library confirmation.
3. Interrupt/reconnect a live Companion recording flow and preserve progress.
4. Repeat core live authoring through paired browser and integrated desktop and compare domain/BuildInput output.

## Genuine later-phase limitations

- B-4 owns real recognition model building, retrieval/matching/localization, confidence, calibration, and certification.
- Automatic/shadow progression remains disabled.
- B-6 owns signed public desktop distribution and application-control reputation.
- Creator-relative accepted areas remain provisional until later localization/calibration exists.

## Rollback

Disable `FEATURE_VISION_BUILD_ENGINE` first. Vision routes can be disabled with the existing Vision feature flag. Back up the database and Companion media, then deploy base commit `eec2c73146a63d6f061254209fef59ac5d4691a5`. The additive columns can remain for B-2 compatibility.

Do not destructively reverse the schema before exporting draft configuration, regions, tests, exact BuildInput text/hash, manifests, audit records, and managed local media. See `B3_Rollback.md`.

## Exit Checklist

### 35.1 Product

- **Pass** — Vision Waypoint Library exists and is reusable.
- **Pass** — Full guided wizard exists.
- **Pass** — All initial waypoint types exist.
- **Pass** — Creator can record target views through the real B-2 adapter.
- **Pass** — Creator can record accepted areas through the real B-2 adapter.
- **Pass** — Creator can record boundary cases through the real B-2 adapter.
- **Pass** — Creator can record hard negatives through the real B-2 adapter.
- **Pass** — Creator can review and manage recordings.
- **Pass** — Creator can edit visual regions.
- **Pass** — Creator receives actionable data-health guidance.
- **Pass** — Creator can leave and resume.
- **Pass** — Creator can generate a schema-valid build-input package.
- **Pass** — Creator can do all of this without source-code changes.

### 35.2 Architecture

- **Pass** — Web and desktop share one implementation.
- **Pass** — Platform-specific operations remain behind adapters.
- **Pass** — Contracts are versioned.
- **Pass** — Published versions are immutable.
- **Pass** — Draft states are explicit.
- **Pass** — No pilot waypoint is hard-coded.
- **Pass** — No B-4 model is embedded directly into story or UI schema.

### 35.3 Data

- **Pass** — Database migrations pass.
- **Pass** — Assets have integrity metadata.
- **Pass** — Deleted recordings do not leave broken references.
- **Pass** — Build-input package is deterministic and validated.
- **Pass** — Locked-test roles are represented.
- **Pass** — Storage and retention state are visible.

### 35.4 Experience

- **Fail (blocked evidence)** — Guided mode is understandable. The interface is implemented and automated accessibility passes, but no required human observation exists.
- **Pass** — Detailed and Engineering modes exist where required.
- **Pass** — Accessibility checks pass.
- **Pass** — Save status is truthful.
- **Pass** — Errors contain recovery actions.
- **Pass** — Studio design matches the product visually and responsively.

### 35.5 Testing

- **Pass** — unit tests pass.
- **Pass** — API tests pass.
- **Pass** — contract tests pass.
- **Pass** — UI tests pass.
- **Pass** — end-to-end tests pass.
- **Pass** — migration tests pass.
- **Fail (blocked evidence)** — usability tests complete. No participants were available; no results were fabricated.
- **Pass** — no severe unresolved accessibility defects.
- **Pass** — no known data-loss bug.

### 35.6 Documentation

- **Pass** — schemas documented.
- **Pass** — routes documented.
- **Pass** — domain-state transitions documented.
- **Pass** — error codes documented.
- **Pass** — Companion interactions documented.
- **Pass** — creator guide written.
- **Pass** — completion report written.
- **Pass** — ADRs added for material decisions.
- **Pass** — demonstration evidence and blocked status preserved.

Because two mandatory checklist items fail, Phase B-3 remains incomplete.
