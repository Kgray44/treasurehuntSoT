---
title: Project Admiralty Phase 1 Validation Record
audience: product-engineering-security-quality
status: current
canonical_for: project-admiralty-phase-1-validation-record
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 1 validation record

## Current decision

**AUTOMATED_PHASE_1_READY_FOR_OWNER_WALKTHROUGH.** The exact tested application
source is `49c2f59d6d75791edbdba84f22f5ec1595d2d129`. Reconciliation merge
`5dde8e179dffb9e4db23b0759953e7117447ef53` contains current `origin/main` at
`5b266251bd5a42efe90988e45daf55bca8e566f1`; the later mainline material is
documentation-governance-only and does not change the tested application.
Automated local and synthetic evidence cannot self-accept the new administrator
and account-owner consent surfaces. Owner decision remains
`PENDING_OWNER_DECISION`.

## Focused and compatibility evidence

| Lane                                | Result                                                                                     | Truth boundary                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Admiralty unit/component/navigation | 9 files, 56 tests passed                                                                   | Local focused diagnostic proof                          |
| Admiralty policy validator          | Passed: 92 capability-floor entries, 8 roles, 6 support scopes, 0 Admin navigation entries | Registry/source boundary proof                          |
| Migration rehearsal                 | Fresh database and prior-head upgrade passed; sentinel row retained                        | Task-owned SQLite proof, not production MySQL execution |
| TypeScript                          | Passed                                                                                     | Local static proof                                      |
| Homeport Phase 5                    | Passed: 92 pages, 200 service sources, no unexplained ordinary orphans                     | Shared route-reachability compatibility                 |
| Homeport Phase 6                    | Passed: 99 screens, 92 pages, 1,125 state pairs, 208 responsive and 26 accessibility cases | Shared screen/state compatibility                       |
| Deepwater                           | 24 tests passed; 54 capabilities and all 42 catalog entries mapped                         | Deterministic cross-program audit compatibility         |

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

## Governed gate receipts

| Gate                                | Result                                                                                                                                              | Boundary                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Production build                    | Passed for the exact tested source                                                                                                                  | Local production build only                                                 |
| Documentation index and validation  | Passed after current-document and engineering-evidence reconciliation                                                                               | Repository documentation governance                                         |
| Feature Catalog sync and validation | Passed with `FT-B009` as `BRANCH_COMPLETE_NOT_MERGED`                                                                                               | Branch availability only                                                    |
| Deepwater audit and validation      | Passed; owner-acceptance terminal rung remains visibly unmet                                                                                        | Cross-program capability truth                                              |
| Sounding Line subsystem authority   | `RELEASE_GO`: 5/5 suites, plan `e52a5c1e9e0dbc3356cc53bcb58c552648a98b5d1963718be86f2ccfa86b1213`, all cleanup `CLEAN`                              | Admiralty unit/component/browser plus shared static/Homeport authority      |
| Sounding Line mainline authority    | `RELEASE_GO`: 32/32 suites and 1,229 registered cases, plan `bb2f8ecfdfa6a4272097a7f7e8651d491a2a8b82e94c21863340efa9599f06e8`, all cleanup `CLEAN` | Authoritative repository-local decision; not deployment or owner acceptance |
| Git reconciliation                  | Current merge anchor contains `origin/main`; exact tested application source is unchanged                                                           | No push, pull request, or mainline merge                                    |

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

## Canonical-state safety

Fixture preparation records
`C:\Users\kkids\Documents\Codex_TreasureHunt\prisma\dev.db` as untouched. All
database migration, browser, and walkthrough work uses a fresh task-owned path
below `%LOCALAPPDATA%\ProjectAdmiralty`. Bootstrap unit coverage is synthetic;
no bootstrap commit was run against canonical or deployed data.

## Retained limits

- owner walkthrough and owner decision remain pending;
- the branch is not pushed, in a pull request, on main, or deployed;
- production MySQL migration/application behavior is not established by local
  SQLite rehearsal or schema parity;
- live providers, physical devices, and physical assistive technology remain
  external;
- Phase 2 and all later command-center capabilities were not started.
