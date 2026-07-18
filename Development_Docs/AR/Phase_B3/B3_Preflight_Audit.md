# Phase B-3 Preflight Audit

Status: complete before implementation

Audit date: 2026-07-18

Canonical repository: `https://github.com/Kgray44/treasurehuntSoT.git`

Implementation branch: `codex/phase-b3-studio-authoring`

Base branch: `origin/codex/phase-b2-native-capture`
Base commit: `eec2c73146a63d6f061254209fef59ac5d4691a5`

## Authority reviewed

The implementation is governed, in order, by:

1. `TT-VISION-GOV-001` version 1.0, especially the Vision Waypoint, Studio, capture methodology, persistent model, usability, and Codex guardrail chapters.
2. `TT-VISION-PHASE-B-001` version 1.0, chapter 9.
3. The Phase B-3 implementation prompt supplied on 2026-07-18.
4. Accepted ADRs 0001 through 0013 and the B-1/B-2 implementation records.
5. Repository security, testing, documentation, and finalization rules.

The canonical PDFs were checked by hash, extracted by chapter, rendered, and visually inspected. Their SHA-256 values remain:

- Governing specification: `3AFEED4F9D267E1A2B670473BE337FDE55129190D1CAD24992E25B3295AF1007`
- Phase B roadmap: `4382680E77C3BA45753C5CF253DDEC6B5E6BE66F214B90957435358C8FF319DD`

The authority requires one shared creator surface, a first-class reusable waypoint library, a resumable twelve-step wizard, real B-2 capture calls, explicit draft state, immutable publication, hard-negative coverage, accessible region editing, computed data health, and deterministic schema-valid build input. It forbids invented capture, training, confidence, localization precision, or usability evidence.

## Repository and concurrent-work state

The original checkout is clean on `main` at `481dc92d26af82f53769bb844fb5359c4766cb5b`, exactly matching `origin/main`, except for two user-owned untracked source PDFs under `Development_Docs`. Those files are preserved and the checkout is not used for B-3 implementation.

The B-2 worktree is clean at `eec2c73146a63d6f061254209fef59ac5d4691a5`, exactly matching `origin/codex/phase-b2-native-capture`. B-3 uses the isolated worktree `C:\Users\kkids\Documents\Codex_TreasureHunt_Phase_B3`. The user reported that the other Tall Tale UI task is finished; no active overlapping editor was found.

## Existing foundation

B-1 and B-2 already provide:

- one Next.js UI for web, PWA, and Electron;
- a narrow Electron shell and one B-2 capture coordinator;
- desktop and paired-browser capture adapters with the same protocol 2.0 commands;
- server-side creator permissions and CSRF protection;
- immutable waypoint versions and exact story bindings;
- normalized capture, asset, pose-region, visual-region, hard-negative, build, certification, and test-run entities;
- managed local creator recordings with content hashes and durable manifests;
- typed feature flags and audited mutations.

B-3 will extend these seams. It will not create a second Studio, capture core, or storage authority.

## Authoring persistence decision

Wizard answers remain part of the versioned draft configuration, with strict step-specific schemas. Relational child records remain authoritative for recordings, accepted-pose regions, visual regions, hard-negative sets, build jobs, artifacts, and tests. The draft version receives an integer authoring revision for optimistic concurrency, along with current-step and mode fields for resumability.

All authoring writes require an expected revision. A stale write returns a typed conflict with the current revision and a reload/merge recovery path. Published versions remain read-only.

## Build boundary

B-3 creates a canonical BuildInput from persisted authoring records, sorted deterministically and hashed. An explicitly enabled development fixture may persist the BuildInput as a completed input-preparation job. It does not train or run a recognition model, create a confidence score, certify runtime behavior, or enable automatic story progression. Real model building remains Phase B-4.

## Demonstration and evidence constraints

At preflight time there is no verified running Sea of Thieves window and no recruited panel of three representative non-CV creators. Automated fixtures can prove contracts, persistence, recovery, rendering, and platform parity, but cannot be represented as real target-game or human-usability evidence.

Unless those external prerequisites become available during final validation:

- the real Sea of Thieves authoring demonstration will be reported as **BLOCKED**;
- the three-profile usability study will be reported as **BLOCKED**;
- related exit-gate lines will remain blocked even if implementation and automated validation pass.

## Preflight conclusion

The B-2 base has the correct shared-product and capture boundaries for B-3. The implementation can proceed additively with one authoring aggregate, optimistic concurrency, strict validation, computed health, deterministic input preparation, and honest external-evidence blockers.
