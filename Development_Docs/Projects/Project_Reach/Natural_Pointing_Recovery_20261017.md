---
title: Reach natural pointing and calibration recovery development record
audience: product-engineering
status: development-preview-pending-physical-retest
canonical_for: reach-natural-pointing-recovery-development-record
last_reviewed: 2026-10-17
---

# Natural pointing and calibration recovery

The owner physically confirmed that the accepted hand model, landmark tracking and rendering worked well, but reported fragile calibration and uncomfortable pointing eligibility. This correction is isolated on `codex/reach-natural-calibration-20261017`, based on protected main `56b700bc2a45bee3ef2cdb5416439bae964f2233`. It is a development preview for another real webcam trial. Protected qualification, integration and physical pointing acceptance remain separate.

## Intended experience

The existing Device connections entry, large camera stage, target plane, conventional controls and relative/absolute workflows remain the same. Camera connection and detected joints are distinct from recognized posture and collection eligibility. The current target freezes during uncertainty, explains recovery, and resumes naturally; completed targets remain visible. A genuine source, hand-generation or view change explicitly requires fresh setup.

Bad or absent frames stop collection and pointer estimates immediately. A returning same-track hand needs 120 ms of fresh eligible anatomy. Initial or replacement selection settles for 250 ms. Existing provider spatial matching has a 1.2-second absence grace; ambiguous crossings and implausible jumps still create new generations. This is local continuity inference, never biometric identity.

The unfinished hold retains agreeing evidence for up to 2.5 seconds, within a five-second wall-time window. Paused and rejected intervals contribute no evidence time. Fifteen samples and at least 600 ms of observed stable evidence remain required. A sustained coherent replacement hold can replace only the unfinished target. There is no forced 20-second retry. Explicit pause, resume and retry remain available.

## Geometry and integrity

Posture uses aspect-corrected inferred x/y/z joint relationships, palm coherence, index bend and separation from competing fingers. Relaxed fingers and a gently bent index are eligible when the index is distinguishable. Open or softly open palms, competing fingers, pinches, folded/hooked indices and collapsed joints abstain. Camera-facing index foreshortening no longer relies on a short projected distal segment alone.

Absolute features use the full index chord with depth-aware palm normalization and the versioned `INDEX_AXIS_RIDGE_V2` mapping. These are empirical camera-relative features. The existing worker returns normalized image landmarks with inferred relative z, not world coordinates or metric depth. [MediaPipe's coordinate documentation](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/hands.md) describes this distinction. Occlusion and uncertain monocular inference can still prevent eligibility or a successful accuracy check.

The pinned model, worker, WASM, camera capture and rendering implementation are preserved. The local observation adapter advances to version 1.2.0: palm association is independent of fingertip eligibility, and partial or temporarily absent palms retain their old records without refreshing timestamps. Observation freshness, ordered timestamps, source/camera/view bindings, held-out targets, raw error and jitter thresholds, supported bounds and privacy/export restrictions remain enforced. Old samples are never rebound to a new hand generation. Long loss can therefore require fresh setup when local identity has expired, even though a shorter posture interruption preserves completed targets.

## Development verification

Candidate `86c679fedee8db0b887e68901eb8770f4078df54` passed 93 focused unit tests, 12 isolated Edge browser cases, scoped lint and TypeScript checks. The real laptop webcam loaded at 640×480/30 fps with worker/model/WASM responses successful and no page errors, then stopped cleanly. The [source-bound development manifest](evidence/natural-pointing-recovery-20261017/manifest.json) separates analytic poses, guided walkthroughs, photographic worker proof and hardware startup from physical accuracy.

The owner's immediate physical follow-up confirmed better detection but exposed remaining framing rejection at the bottom target and pointer loss during movement among held-out targets. These observations require a further local correction; this candidate's passing software checks do not close that physical feedback.

Focused unit regressions cover relaxed and foreshortened pointing, negative poses, outliers, segmented evidence time, brief occlusion/recovery, stale evidence, binding changes and strict held-out failure. Browser evidence distinguishes analytic D0 replay and photographic worker fixtures from real webcam capture. The preview uses its own worktree, database, loopback port and browser contexts; Crossdeck and ongoing Sounding Line repairs are outside this work.

The final local results and physical limitations are recorded with the delivered preview. No software test proves physical screen intersection, ergonomics or owner acceptance. The next owner trial should test comfortable pointing at the screen, brief finger relaxation and occlusion during a partly collected hold, then complete the independent check before entering the playground.
