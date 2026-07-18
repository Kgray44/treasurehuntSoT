# Phase B-4 Architecture and Contracts

## Boundary

The shared Next.js app owns authenticated authoring, BuildInput, durable job state, certification rows, lifecycle, audit, and shadow-analysis records. The existing Electron Companion owns local media, derived frames, build execution, packages, live pixels, and runtime verification.

Flow:

1. Studio validates the version-owned B-3 aggregate and persists canonical BuildInput in a `QUEUED` job.
2. The platform adapter submits that exact input/hash/timestamp to Companion.
3. Companion resolves only managed artifact IDs, verifies recording and frame-set hashes, builds and tests the package, then atomically publishes it.
4. Studio persists progress and terminal metadata through the owned API. Completion creates `VisionBuildArtifact` and `VisionCertificationRun` in one transaction.
5. A shadow scan arms one package/version/stage token, consumes selected player frames in memory, persists a `VisionShadowAttempt`, and emits no story event.

## Versions

- Companion protocol: 2.0
- build input: 1
- derived frame set: 1
- runtime package: 1
- build report: 1
- runtime result: 1
- engine: `1.0.0-b4`
- model bundle label: `classical-vision-cpu-1`

## Build state

`QUEUED -> INGESTING -> VALIDATING_INPUT -> CURATING_FRAMES -> EXTRACTING_GLOBAL_FEATURES -> EXTRACTING_LOCAL_FEATURES -> MATCHING_REFERENCE_GRAPH -> RECONSTRUCTING -> BUILDING_TARGET_INDEX -> BUILDING_NEGATIVE_INDEX -> ESTIMATING_ACCEPTED_POSE_VOLUME -> CALIBRATING -> RUNNING_VALIDATION -> RUNNING_LOCKED_TESTS -> PACKAGING -> VALIDATING_PACKAGE -> COMPLETE`

Terminal alternatives are `FAILED` and `CANCELLED`. Every progress event contains stage, stage progress, overall progress, message code, build ID, and timestamp.

## Runtime state

The runtime implements the governed state vocabulary from `IDLE` through `ARMED`, capture/curation/feature/retrieval/matching/geometry/localization/evaluation, and the six stable result classes. One attempt ID has one terminal result; repeated completion reads are idempotent.

The result contract includes package/waypoint identity, result, guidance, retry/Captain-review flags, captured/usable/passing counts, failed gates, evidence digest, versions, provider/fallback, duration, `shadowMode=true`, and `automaticProgression=false`.

## Mandatory gates

Capture quality, stage context, target retrieval, hard-negative margin, local matching, geometry, pose, orientation/visibility, spatial coverage, temporal consistency, checkpoint-specific rules, and ambiguity veto are persisted separately. Verification requires every applicable gate. Global retrieval only selects candidates.

## Package

The package is a canonical data envelope containing manifest plus named JSON artifacts for runtime config, target/negative indexes, local features, reference graph, reconstruction, accepted pose regions, stable regions, checkpoint rules, calibration, guidance, compatibility, and certification. Each artifact has size and SHA-256. The full package digest covers the manifest (excluding its self-referential digest/size) and all artifacts. Loader validation rejects traversal names, duplicates, corruption, unsupported schemas, engine/model mismatches, wrong waypoint versions, and memory-budget violations.

Package IDs are content-derived from BuildInput plus engine/model versions. Given the same build ID, build timestamp, input, engine, and model version, bytes and hash reproduce.
