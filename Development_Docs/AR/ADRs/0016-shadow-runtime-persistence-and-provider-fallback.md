# ADR 0016: Shadow runtime persistence and truthful provider fallback

Status: accepted for Phase B-4

## Context

B-4 must support build and runtime provider selection, persisted shadow outcomes, cancellation, stale-stage prevention, and safe rollback. GPU hardware detection alone is not proof that a CUDA or DirectML inference backend exists.

## Decision

Use a Companion `VisionEngineService` as the single job coordinator:

- one local build and one armed runtime attempt at a time;
- explicit build and runtime commands through both the restricted desktop bridge and authenticated loopback transport;
- cancellable builds, bounded payloads, deadlines, frame limits, and idempotent terminal reads;
- CUDA and DirectML are reported as detected-only providers and never selected as active;
- CPU classical is the only active provider and is used only when fallback is permitted;
- provider attempts and fallback are included in build/runtime diagnostics;
- stale stage tokens return `SYSTEM_ERROR/STAGE_TOKEN_STALE`, never a location failure;
- the server transactionally persists build artifacts, certification, lifecycle, and audit records after Companion completion;
- runtime outcomes use `VisionShadowAttempt`, which fixes `shadowMode=true` and `automaticProgression=false` and supports later human truth and rebuild disposition.

Feature flags independently gate build, runtime, reconstruction experiments, secondary resolver experiments, and shadow verification. Automatic Vision progression stays disabled even when a synthetic certification grade is excellent.

## Consequences

Hardware inventory is honest and fallback is observable. A local Companion result is not treated as persisted until the authenticated API update succeeds. Runtime analysis can accumulate truth labels without coupling B-4 to a live story session or emitting a story success event.
