---
title: Project Wakebook Phase 2 Integration Manifest
audience: product-engineering
status: blocked-v14-policy-admission
canonical_for: project-wakebook-phase-2-integration-manifest
last_reviewed: 2026-08-18
---

# Project Wakebook Phase 2 integration manifest

| Item                    | Current state                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------- |
| Branch                  | `codex/project-wakebook-phase2-bind-the-voyages`                                   |
| Reconciled main         | `fc39942a1d8fe57fc13f35cae01445e704b94c45`                                         |
| Worktree                | task-owned local Companion worktree                                                |
| Mainline reconciliation | v1.4 authority, Bridgewatch, navigation, and generated control-plane work retained |
| Implementation source   | `faeec00ff755d4ab63c9427bdaf3a394fd93145a`                                         |
| Legacy evidence         | `823c9f726d778f59aa6df5dc5f2f383b7c22b5ba` preserved; affected evidence rebound    |
| Phase state             | `CANDIDATE_QUALIFICATION_IN_PROGRESS`                                              |
| Protected merge         | Prohibited until frozen-source hosted authority returns `RELEASE_GO`               |

The current-main interval included Sounding Line v1.4 browser/fixture and
authority repairs, Project Trim documents, and Bridgewatch work. It did not
modify Wakebook/Wayfarer product source, Phase 2 routes, or Prisma schema and
migrations. Accepted main won outside Wakebook seams; the generated catalog,
registry, and impact map were rebuilt, and Wakebook's Phase 2 contracts and
`wakebook-phase2` Chromium mapping were retained. No Phase 3 work is included.

The exact focused hosted suite is `browser.wakebook`; its branch dispatch is
prevented before worker execution by the v1.4 protected-main-context rule. The
frozen candidate must therefore receive the current protected authority/train
browser evidence before it can be called candidate-qualified.

The candidate was then submitted through the trusted-main v1.4 authority as
PR #197, candidate `e03629b8a01611ff87cb79023410fd05b8219b5b`, and base
`fc39942a1d8fe57fc13f35cae01445e704b94c45`. Run `32139704608` rejected the
required Phase 2 contract, impact-map, and suite registrations as
authority-changing and its records/catalog/test registration as unlisted
ordinary paths. Mainline-train admission uses that same classifier. The
candidate is therefore preserved but blocked awaiting a protected-main policy
admission owned outside this product branch; it cannot merge or be walked
through as accepted work.
