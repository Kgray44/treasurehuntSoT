---
title: Project Tideglass Phase 3 Product Walkthrough
audience: product-owner
status: candidate-frozen-owner-walkthrough-pending
canonical_for: project-tideglass-phase-3-product-walkthrough
last_reviewed: 2026-08-12
---

# Project Tideglass Phase 3 product walkthrough: Choose the Passage

Status: source-bound candidate evidence is complete; canonical owner walkthrough remains pending. The generated visual manifest records the exact candidate SHA, fixture checksum, routes, viewports, screenshot hashes, and semantic assertions. This document does not record owner acceptance.

## Safe walkthrough runtime

Run `npm run tideglass:phase3:journeys` from the dedicated Phase 3 worktree. The launcher creates a local, task-owned synthetic fixture under `%LOCALAPPDATA%\\ProjectTideglass\\phase3-qualification`, starts the real production build, runs the journey, and stores private credentials, screenshots, Playwright report, and `browser/evidence/manifest.json` under that task root. It does not use or mutate `prisma/dev.db`.

The available synthetic role aliases are Anonymous, Player A, Player AB, Player C, Creator, and Foreign. Credentials remain in the private task root and are not recorded in this document.

## Owner review route

1. From the Gateway, use **Explore Chronicles**, open **Preview Chronicle**, and choose **See what changed**.
2. Confirm the ordinary What Changed screen gives selected-edition context, human edition metadata, source/target selectors, swap, current-publishing target, concise/detailed presentation, semantic cards, compatibility wording, category filtering, and a bounded return action.
3. Review the synthetic public, partial, and no-history states. Partial must describe unavailable semantic scope without exposing source snapshots or hidden details.
4. Sign in as Player A and enter from Passport history. Confirm the played edition and its recorded lifecycle/outcome are selected; safe-to-reveal story detail stays collapsed until the explicit control is used.
5. Sign in as Player AB to review separately selectable historical records, then as Player C to see the intentional up-to-date state.
6. Sign in as Creator and use the Version history **Compare to current** action. Confirm technical semantic detail and semantic cards are shown, never raw storage values.
7. Review the 390px reduced-motion view, keyboard access, and effective 200% zoom capture in the generated manifest.

## Acceptance boundary

This synthetic local walkthrough is suitable for product review of the governed experience. It is not staging, production, live-provider, physical-device, protected-mainline, or real-user proof. Owner approval must identify the reconciled frozen candidate explicitly. Only after that approval may the task dispatch its one Sounding Line Mainline Decision.
