---
title: Project Admiralty Phase 1 Validation Record
audience: product-engineering-security-quality
status: current
canonical_for: project-admiralty-phase-1-validation-record
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 1 validation record

## Current decision

**OWNER_ACCEPTED_RECONCILED_MAINLINE_CANDIDATE.** The exact tested application
source is `49c2f59d6d75791edbdba84f22f5ec1595d2d129`; the owner completed the
walkthrough against `750b904cfec013f0b6adec3d930caf5eeae9ec0b` and recorded
`ACCEPTED` on `2026-08-09`. Reconciliation merge
`0ba4df35e7bf6a9597ca8d52ff9063e320554a24` contains current `origin/main` at
`40d822cd936c9abbfce064fd7799e6a2f8c9785e`. The intervening Tideglass work
overlaps shared catalog, Deepwater, Sounding Line, documentation, and test
registries but does not change Admiralty application or schema code. Its
source-bound effect must be decided by the new Sounding Line run before
integration.

## Focused and compatibility evidence

| Lane                                | Result                                                                                                                                          | Truth boundary                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Admiralty unit/component/navigation | 9 files, 56 tests passed                                                                                                                        | Local focused diagnostic proof                          |
| Admiralty policy validator          | Passed: 92 capability-floor entries, 8 roles, 6 support scopes, 0 Admin navigation entries                                                      | Registry/source boundary proof                          |
| Migration rehearsal                 | Fresh database and prior-head upgrade passed; sentinel row retained                                                                             | Task-owned SQLite proof, not production MySQL execution |
| TypeScript                          | Passed                                                                                                                                          | Local static proof                                      |
| Homeport Phase 5                    | Passed: 92 pages, 200 service sources, no unexplained ordinary orphans                                                                          | Shared route-reachability compatibility                 |
| Homeport Phase 6                    | Passed: 99 screens, 92 pages, 1,125 state pairs, 208 responsive and 26 accessibility cases                                                      | Shared screen/state compatibility                       |
| Deepwater                           | Reconciled to 55 capabilities and all 43 catalog entries; Admiralty is `FT-B010` and owner-accepted while still branch-only pending integration | Deterministic cross-program audit compatibility         |

## Production-browser evidence

The isolated Chromium journey passed against a fresh reserved synthetic fixture
at exact source `49c2f59d6d75791edbdba84f22f5ec1595d2d129`.

- ordinary user: no Admin navigation, direct `/admin` deliberate not-found, no
  privileged payload;
- administrator: limited shell, capability projection, assurance-required
  denial, successful password reauthentication, forced expiry, and renewal;
- Support Access: exact request, visible purpose/scopes/exclusions, approval,
  scoped sanitized read, denial, cancellation/revocation, and immediate access
  loss;
- authority invalidation: role revocation produces not-found and parent-session
  revocation produces unauthenticated API denial;
- interaction/accessibility: desktop, 390-pixel mobile, keyboard, reduced
  motion, effective 200 percent, and zero serious/critical automated
  accessibility findings.

Eight PNG captures and their SHA-256 values are retained outside the repository
under
`C:\Users\kkids\AppData\Local\ProjectAdmiralty\phase1-validation-20260809-mainline\browser\evidence`.
The manifest status is
`AUTOMATED_BROWSER_PROOF_COMPLETE_OWNER_WALKTHROUGH_PENDING`. The private
credential handoff and synthetic database remain external; no password, token,
cookie, raw database, or private product material is committed.

## Owner walkthrough evidence

The owner completed the full Phase 1 walkthrough on `2026-08-09` against
source `750b904cfec013f0b6adec3d930caf5eeae9ec0b` and recorded `ACCEPTED`.
Ordinary-user denial without exposure, authorized administration, privileged
reauthentication, exact-scope request review, approval, denial, bounded reads,
audit visibility, revocation, immediate revoked-access denial, visual
coherence, and Living Registry truth were accepted. The deliberately limited
account projection and absence of broad support or administrative write/edit
tooling were accepted as later-phase scope, not defects.

## Governed gate receipts

| Gate                                | Result                                                                                                                                                       | Boundary                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Production build                    | Passed for the exact tested source                                                                                                                           | Local production build only                                                 |
| Documentation index and validation  | Passed after current-document and engineering-evidence reconciliation                                                                                        | Repository documentation governance                                         |
| Feature Catalog sync and validation | Reconciliation assigned Admiralty `FT-B010` as `BRANCH_COMPLETE_NOT_MERGED`; exact candidate validation is pending                                           | Owner-accepted branch availability only                                     |
| Deepwater audit and validation      | Reconciled owner-acceptance rung; exact candidate validation is pending                                                                                      | Cross-program capability truth                                              |
| Sounding Line subsystem authority   | `RELEASE_GO`: 5/5 suites, plan `31bcc47fd7a0d1a6e7cd59b7a4014edffe27cbe2ebec06f790d256476eb5deb8`, all cleanup `CLEAN`                                       | Admiralty unit/component/browser plus shared static/Homeport authority      |
| Sounding Line mainline authority    | `RELEASE_GO`: 32/32 suites and 1,246 selected registered cases, plan `fa4691c5f60b84c40fa85b9b26e26efddc4034008d71054f30b5c36aaa777a6b`, all cleanup `CLEAN` | Authoritative repository-local decision; not deployment or owner acceptance |
| Git reconciliation                  | Merge `0ba4df35` contains current `origin/main` `40d822cd`; exact tested Admiralty application source is unchanged                                           | No push or canonical mainline integration yet                               |

The first mainline attempt failed before suite execution because the owned
worktree intentionally lacked the ignored `prisma/dev.db` baseline required by
the accepted access-sentinel adapter. A hash-identical task-owned copy was
provided, the canonical hash remained
`54647911F63C6A55E5C6B6C95E5EC0A2977B4580A42DE073C8C503A3D8C7A412`, and the
copy was removed after validation. The next run correctly caught the old
41-entry Feature Catalog test expectation; it was advanced to 42. Two sentinel
attempts then failed closed while concurrent Helm/Shipwright browser lanes held
the shared validation lease. No lock or process was stolen. The final run
acquired the lease through an exclusive availability probe and passed all 32
receipts.

After Deepwater Phase 2 reached `origin/main`, its accepted trace policy still
correctly excluded the unaccepted Admiralty capability. The reconciled
validator now permits only explicitly `BRANCH_COMPLETE_NOT_MERGED` queue items
to remain outside that accepted trace scope, rejects an omitted mainline item,
and does not create a Phase 2 remediation packet from Admiralty branch work.

## Canonical-state safety

Fixture preparation records
`C:\Users\kkids\Documents\Codex_TreasureHunt\prisma\dev.db` as untouched. All
database migration, browser, and walkthrough work uses a fresh task-owned path
below `%LOCALAPPDATA%\ProjectAdmiralty`. Bootstrap unit coverage is synthetic;
no bootstrap commit was run against canonical or deployed data.

## Retained limits

- owner walkthrough is complete and the owner decision is `ACCEPTED`;
- the reconciled candidate is not yet on canonical main or deployed;
- production MySQL migration/application behavior is not established by local
  SQLite rehearsal or schema parity;
- live providers, physical devices, and physical assistive technology remain
  external;
- Phase 2 and all later command-center capabilities were not started.
