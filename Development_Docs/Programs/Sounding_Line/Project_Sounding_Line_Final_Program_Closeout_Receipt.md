---
title: Project Sounding Line Final Program Closeout Receipt
audience: engineering
status: current
canonical_for: sounding-line-local-control-plane-closeout
last_reviewed: 2026-07-30
---

# Project Sounding Line Final Program Closeout Receipt

## Accepted scope

The repository-local, nonauthoritative Sounding Line control plane is complete
through Phases 1-4: policy and inventory validation, deterministic planning and
history, leased runtime ownership, root/cascade evidence, provider-neutral
worker controls, sealed assignments, evidence integrity, attestation,
revocation, local/CI comparison, and emergency serial fallback. The focused
workflow uses `npm ci` and is secret-free and read-only.

This receipt is not release authorization. `P34-BME-20260729` remains a
historical non-green browser-matrix exception, not a 316-case pass. Hosted CI
execution, separate remote workers, provider/MySQL validation, production
signing, and branch-protection application are `EXTERNAL_PENDING`; none is
counted as a local or release pass.

## P34 compatibility review

The inherited changes below were reviewed before closeout and targeted-restored
to their exact branch base. They were P34-only restorations of the retired
`PlayerExperience` route, replay/timing behavior, or its visual catalog, and
no canonical product regression justified retaining them:

- `src/animation/journal/opening-machine.test.ts`
- `src/animation/journal/opening-machine.ts`
- `src/animation/scenes/scene-utils.ts`
- `src/app/play/[taleSlug]/session/[sessionId]/page.tsx`
- `src/chronicle/progression.test.ts`
- `src/compatibility/legacy-quartermaster.ts`
- `src/components/player/PlayerExperience.test.tsx`
- `src/components/player/PlayerExperience.tsx`
- `src/components/player/progression/ProgressionPresentationController.test.ts`
- `src/components/player/progression/ProgressionPresentationController.ts`
- `tests/e2e/phase3-visual-checkpoints.spec.ts`

No progression behavior, legacy replay control, visual timing delay, or
checkpoint-catalog compatibility code was retained by this closeout.

## Evidence and continuation

The definitive final-validation results, pushed source identity, hosted focused
workflow result, and protected-main integration identity are recorded only
after those operations complete. A failed, blocked, unavailable, or skipped
gate remains a non-pass. The next safe action is the bounded final validation
sequence defined by this closeout; it excludes the retired full P34 matrix.
