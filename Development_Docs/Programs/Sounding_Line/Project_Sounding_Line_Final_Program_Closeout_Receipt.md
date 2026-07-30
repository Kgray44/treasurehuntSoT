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
historical non-green browser-matrix exception, not a 316-case pass. GitHub
Actions run `30545314821` passed the focused workflow on integration SHA
`68b18b40c0b4ee2cee66324aa8643789c4172f41`. Separate remote workers,
provider/MySQL validation, production signing, and branch-protection
application remain `EXTERNAL_PENDING`; none is counted as a release pass.

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

Local validation and the hosted focused workflow both passed. GitHub merged the
protected-main pull request as `84295f65a86efa4777084b587063d57fa75b07fe`; its
tree is identical to the hosted-tested integration SHA. A failed, blocked,
unavailable, or skipped gate remains a non-pass. Any future validation follows
the bounded sequence defined by this closeout and excludes the retired full P34
matrix.
