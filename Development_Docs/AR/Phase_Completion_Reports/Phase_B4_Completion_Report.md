# Phase B-4 Completion Report

## Summary

Phase B-4 has a functioning local-first verification foundation: a governed Studio build handoff, native Companion build/runtime services, project-authored classical descriptors and geometry, immutable data-only packages, mandatory multi-frame gates, shadow-result persistence, replay fixtures, diagnostics, rollback controls, and full-stack tests.

**Completion status: INCOMPLETE.** The software implementation is substantial, but the mandatory three real Sea of Thieves pilots, independent field corpora, live demonstration, GPU evidence, game-impact observations, and field reliability measurements do not exist. Synthetic fixtures cannot substitute for those exit gates.

Major technical limitations are planar relative localization rather than general metric 3D, no learned semantic model, no item-pickup detector, and CPU-only inference. Every package remains shadow-only and ineligible for automatic story progression.

## Repository state

- Starting branch: `codex/phase-b4-verification-runtime`, forked from `codex/phase-b3-studio-authoring`.
- Starting commit: `7ebce5d7c435ae8e998d5ec8207937de5d70db06`.
- Final branch: `codex/phase-b4-verification-runtime`.
- Implementation evidence commit: `PENDING_FINALIZATION` (replace after the implementation commit; later chat/document synchronization may add a scoped follow-up commit).
- Working tree at evidence capture: implementation and documentation changes present; generated validation output remained outside the repository runtime mirror.

## Architecture

The shared Next.js platform owns authentication, authoring aggregates, canonical BuildInput, durable build/certification truth, lifecycle, audits, and shadow analysis. The existing Electron Companion owns selected-window capture, creator media/derived frames, build execution, immutable packages, live player pixels, and runtime verification. The browser and desktop use stable platform adapters; model-specific details never enter story blocks.

The model adapter currently exposes one active `CPU_CLASSICAL` provider and detected-only CUDA/DirectML inventory. Build and runtime operate as bounded asynchronous services with cancellation, timeouts, progress, idempotent terminal reads, and explicit failure classes.

Packages are canonical data envelopes, never executable plugins. Named JSON artifacts are allowlisted and individually hashed; a package digest covers the manifest and artifacts. Publication is atomic and immutable. ADR 0015 records the classical engine/data-package decision; ADR 0016 records shadow persistence and honest fallback.

## Models and libraries

No third-party model weights, vision binary, dataset, or new runtime library was added. `classical-vision-cpu-1` labels project-authored JavaScript algorithms: gray-gradient spatial-pyramid descriptors, gradient-patch local descriptors, mutual ratio matching, deterministic homography/RANSAC, convex-hull/grid coverage, planar reference graphs, relative pose approximation, and per-waypoint calibration.

The implementation uses Node built-ins and existing repository dependencies. CUDA and DirectML have no active backend and no package size. The source, license boundary, provider truth, and future approval requirements are documented in `B4_Models_Libraries_and_Licenses.md`.

## Database and schemas

Migration `20260718190000_vision_verification_runtime_b4` and MySQL migration `0008_vision_verification_runtime_b4` extend build-job progress/package/provider/reliability truth and add `VisionShadowAttempt` with gate, evidence, provider, duration, human-truth, Captain-action, and rebuild-lineage fields.

Build completion transactionally creates `VisionBuildArtifact` and `VisionCertificationRun`, advances only the governed waypoint lifecycle, and always stores `automaticEligibility=false`. B-1 through B-3 rows remain readable; old recordings without derived B-4 frame sets receive a remediation error rather than fabricated compatibility.

## Build pipeline

Implemented stages are validation, role partitioning/leakage checks, frame-set hash verification, quality filtering, deduplication, global/local feature extraction, reference-graph matching, planar reconstruction, target and hard-negative indexes, accepted pose finalization, BALANCED/STRICT/STORY_CRITICAL/CUSTOM calibration, validation, locked tests, grading, package serialization, package integrity reload, and atomic publication.

The build is bounded, cancellable, timeout-aware, and deterministic for the same governed input/build identity/timestamp/engine/model. Failures carry stable codes and creator actions. Interrupted builds retain durable progress and can be retried as a new governed build; immutable published packages are never mutated.

## Runtime pipeline

Runtime evaluates several frames through capture quality, stage context, target retrieval, hard-negative margin, secondary disagreement, local matching, geometric inliers, planar pose, orientation/visibility, spatial coverage, temporal consensus, checkpoint rules, and ambiguity veto. Global similarity only retrieves candidates; it cannot approve a result or override a negative.

The six stable results are `VERIFIED`, `NOT_AT_TARGET`, `AMBIGUOUS`, `INSUFFICIENT_VISUAL_EVIDENCE`, `CANCELLED`, and `SYSTEM_ERROR`. Guidance is deterministic and identifies severity, action, retry policy, and Captain-review recommendation. Player frames are zeroized; stored shadow rows contain metrics/hashes, not pixels. `automaticProgression=false` is invariant.

## Pilot waypoints

Three materially different mathematical fixtures exercise the general engine:

1. Easy exact landmark, BALANCED profile: independent positive verifies; negative is not-at-target; weak evidence is insufficient.
2. Moderate natural location, STRICT profile: independent positive verifies; confusable negative is ambiguous; weak evidence is insufficient.
3. Difficult confusable viewpoint, STORY_CRITICAL profile: independent positive verifies; confusable negative is ambiguous; weak evidence is insufficient.

Each has independent target, negative, validation, and locked assets plus an accepted planar pose region. Their input/package hashes are in `B4_Test_Plan_and_Results.md`. All are synthetic mathematical fixtures with `seaOfThievesClaim=false`; they are not the three required real pilot waypoints.

## Test results

Exact primary command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-all.ps1 -SkipBrowserInstall
```

Result: exit 0; 9 migrations; formatting/lint/typecheck passed; 111 Vitest tests, 3 desktop tests, 28 Companion tests, and 32 Playwright tests passed; 0 failed; 12 intentional WebKit mutation/shared-database skips; production build and two restarts passed.

Replay command:

```powershell
node scripts/run-vision-b4-replay.cjs --output Development_Docs/AR/Phase_B4/Evidence/synthetic-replay-report.json
```

Result: exit 0. Package corruption, unsafe names, duplicates, incompatibility, provider fallback, cancellation, timeout, stale stage, leakage, deterministic repeat, idempotency, positives, negatives, and weak evidence are covered. Real pilot corpus and GPU tests were not run. Dataset and package hashes are in the test report and replay JSON.

## Performance

The test host used an AMD Ryzen AI 7 350 (8 cores/16 threads), about 31.1 GiB RAM, NVIDIA RTX 5070 Laptop GPU, AMD Radeon integrated graphics, Windows build 10.0.26200, and Node v24.18.0. Only `CPU_CLASSICAL` was active.

The three-fixture replay took 1,298 ms wall time with 1,422 ms user CPU, 94 ms system CPU, and an observed RSS rise from 56,426,496 to 142,495,744 bytes. Positive runtime calls measured 50-69 ms. These are synthetic warm measurements, not game-impact or production percentile evidence. GPU, VRAM, thermal, long-session, and game contention tests were not run.

## Security and privacy

Pixels remain inside Companion. Creator recordings/derived grayscale frames use managed local storage and creator retention. Runtime frames use a bounded ring and are zeroized; diagnostics contain metrics and hashes. Packages reject traversal, duplicates, corruption, incompatible versions, and memory-limit violations. Browser transport preserves exact-origin pairing, proof, replay protection, request bounds, and rate limits; server routes enforce authentication, ownership, CSRF, input hash, and raw-field rejection.

No process injection, memory reading, game-file reading, input automation, in-game overlay, packet inspection, network interception, or cloud vision processing was added.

## Demonstration

The automated replay demonstrates real production-engine build stages, package reload, valid scans, confusable negatives, insufficient evidence, package failure, and provider fallback. `B4_Pilot_and_Demonstration_Report.md` contains exact commands and expected results; the captured JSON is under `Phase_B4/Evidence`.

The live Studio-to-Companion Sea of Thieves demonstration was not run because authorized field recordings were unavailable. Consequently, real shadow persistence and no-progression behavior are implemented and contract-tested but lack the required live-game capture evidence.

## Exit-gate checklist

### Architecture

- TRUE — Real build and runtime services exist behind stable adapters.
- TRUE — Model details are isolated from story/waypoint schemas.
- TRUE — B-1 through B-3 contracts remain compatible or deliberately migrated.
- TRUE — Material decisions are documented in ADRs 0015 and 0016.

### Build engine

- TRUE — Schema-valid B-3 input is ingested.
- TRUE — Frames are quality-filtered and deduplicated.
- TRUE — Dataset leakage is checked.
- TRUE — Global and local features are produced.
- TRUE — Hard-negative indexes are produced.
- TRUE — Applicable planar reconstruction works in the implemented engine/fixtures; general metric 3D is explicitly unavailable.
- TRUE — Accepted pose regions are finalized.
- TRUE — Per-waypoint/profile calibration is produced.
- TRUE — Locked tests execute.
- TRUE — Runtime packages publish atomically.
- TRUE — Package integrity is validated.

### Runtime engine

- TRUE — Multi-frame scans, target retrieval, hard-negative separation, local matching, and geometric verification are implemented.
- TRUE — Planar camera localization is implemented where applicable.
- TRUE — Pose, orientation, visibility, spatial coverage, temporal consistency, and checkpoint rules are enforced.
- TRUE — Ambiguity veto exists.
- TRUE — Structured results and guidance are returned.
- TRUE — Player frames are discarded and zeroized by default.

### Reliability

- FALSE — Three real distinct pilot waypoints are not implemented; only synthetic fixtures exist.
- FALSE — Real unseen positive scans are not tested.
- FALSE — Real hard-negative scans are not tested.
- FALSE — Real boundary cases are not tested.
- FALSE — Zero locked-pilot false accepts cannot be claimed without a real locked corpus.
- FALSE — First-scan and guided-retry field success are not measured.
- TRUE — No package is automatic-ready; all eligibility/progression fields are false.
- TRUE — Reports disclose the limitations and synthetic boundary.

### Integration

- TRUE — Studio consumes real Companion progress and persists terminal build truth.
- TRUE — Studio reliability reporting and package lifecycle are implemented.
- TRUE — Shadow result persistence is implemented with an authenticated API and owned table.
- TRUE — Automatic story progression is structurally disabled.
- TRUE — Errors propagate as distinct failures rather than location judgments.
- FALSE — The required live Studio/Companion/game demonstration has not been captured.

### Performance and operations

- TRUE — Provider detection and safe CPU fallback are tested.
- TRUE — Synthetic runtime latency is measured.
- FALSE — Complete CPU, GPU, and memory behavior is not measured; GPU backend/tests are absent.
- FALSE — Game-impact observations are absent.
- TRUE — Build recovery/cancellation and runtime cancellation/timeout are implemented and tested.
- TRUE — Structured logs, persisted gates, and evidence digests support diagnostics.
- TRUE — Compatibility/versioning and rollback are documented.

### Documentation

- TRUE — Schemas/contracts and failure/guidance codes are documented.
- TRUE — Replay harness, models/licenses/providers, pilot limitations, and rollback are documented.
- TRUE — This completion report exists.
- TRUE — Governing specifications were not changed; implementation ADRs/docs record only subordinate decisions.

Because mandatory reliability, live-demonstration, GPU, and game-impact items are false, Phase B-4 is not complete.

## Deferred work

- B-5: execute the governed Player/Captain/story integration on field-qualified packages; validate Captain review and progression policy. Automatic progression remains disabled until that phase authorizes it.
- B-6: harden deployment, diagnostics, compatibility, recovery, operational telemetry, and release evidence after field qualification.
- Approved future external-AR work: evaluate learned semantic descriptors, general metric 3D, item detection, and active CUDA/DirectML providers only through new ADR/license/model-card/security/field-validation approval.
- B-4 prerequisite work (not re-phased): capture and lock the three real pilot corpora, run live demonstrations, measure field reliability and game impact, and update this report before claiming B-4 completion.

## Rollback

Set `FEATURE_VISION_BUILD_ENGINE`, `FEATURE_VISION_RUNTIME_ENGINE`, `FEATURE_VISION_RECONSTRUCTION`, `FEATURE_VISION_SECONDARY_MATCHER`, and `FEATURE_SHADOW_VERIFICATION` false; keep `FEATURE_AUTOMATIC_VISION_PROGRESSION=false`. Cancel active work, stop Companion, deploy the B-3 source commit or a later safe release, retain additive database truth until exported, and preserve creator recordings/packages. Application rollback never authorizes an existing package for automatic use.
