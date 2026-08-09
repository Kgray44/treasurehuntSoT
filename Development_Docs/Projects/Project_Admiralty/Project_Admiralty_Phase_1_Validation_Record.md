---
title: Project Admiralty Phase 1 Validation Record
audience: product-engineering-security-quality
status: current
canonical_for: project-admiralty-phase-1-validation-record
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 1 validation record

## Current decision

**ACCEPTED_MAINLINE.** The exact tested application source is
`49c2f59d6d75791edbdba84f22f5ec1595d2d129`; the owner completed the walkthrough
against `750b904cfec013f0b6adec3d930caf5eeae9ec0b` and recorded `ACCEPTED` on
`2026-08-09`. Final reconciled implementation source
`fe5e18eb6312c2571616a8faf2dfe1c8583cbd9f` contains accepted `origin/main`
`0ded9be4af04feb1785fd9e56abbacdd39f54b3d`, received exact-source Sounding Line
`RELEASE_GO`, reached canonical main, and proved local/remote parity `0/0`.
Intervening Tideglass, Deepwater Phase 3, and Feature Catalog work changed
shared catalog, Deepwater, Sounding Line, documentation, and test registries but
did not change Admiralty application or schema code.

## Focused and compatibility evidence

| Lane                                | Result                                                                                                                | Truth boundary                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Admiralty unit/component/navigation | 9 files, 56 tests passed                                                                                              | Local focused diagnostic proof                          |
| Admiralty policy validator          | Passed: 92 capability-floor entries, 8 roles, 6 support scopes, 0 Admin navigation entries                            | Registry/source boundary proof                          |
| Migration rehearsal                 | Fresh database and prior-head upgrade passed; sentinel row retained                                                   | Task-owned SQLite proof, not production MySQL execution |
| TypeScript                          | Passed                                                                                                                | Local static proof                                      |
| Homeport Phase 5                    | Passed: 92 pages, 200 service sources, no unexplained ordinary orphans                                                | Shared route-reachability compatibility                 |
| Homeport Phase 6                    | Passed: 99 screens, 92 pages, 1,125 state pairs, 208 responsive and 26 accessibility cases                            | Shared screen/state compatibility                       |
| Deepwater                           | Reconciled to 55 accepted-main capabilities and all 43 catalog entries; Admiralty is owner-accepted `FT-B010` on main | Deterministic cross-program audit compatibility         |

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

| Gate                                | Result                                                                                                                                                                                                                                                    | Boundary                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Production build                    | Passed for the exact tested source                                                                                                                                                                                                                        | Local production build only                                                 |
| Documentation index and validation  | Passed after current-document and engineering-evidence reconciliation                                                                                                                                                                                     | Repository documentation governance                                         |
| Feature Catalog sync and validation | Admiralty `FT-B010` promoted to `MAINLINE`; generated 43-entry catalog sync and validation pass                                                                                                                                                           | Owner-accepted mainline availability                                        |
| Deepwater audit and validation      | Reconciled 55 accepted-main capabilities, including owner-accepted Admiralty, with deterministic validation                                                                                                                                               | Cross-program capability truth                                              |
| Sounding Line subsystem authority   | `RELEASE_GO`: 5/5 suites, plan `31bcc47fd7a0d1a6e7cd59b7a4014edffe27cbe2ebec06f790d256476eb5deb8`, all cleanup `CLEAN`                                                                                                                                    | Admiralty unit/component/browser plus shared static/Homeport authority      |
| Sounding Line mainline authority    | `RELEASE_GO`: 32/32 suites and 1,246 selected registered cases, plan `fa4691c5f60b84c40fa85b9b26e26efddc4034008d71054f30b5c36aaa777a6b`, all cleanup `CLEAN`                                                                                              | Authoritative repository-local decision; not deployment or owner acceptance |
| Final preintegration authority      | `RELEASE_GO`: source `fe5e18eb`, 33/33 suites, 1,308 selected registered cases, plan `7d04f6e3258518dea4e549811599e19c30808d3511d0f8f0758652f481f5c77d`, evidence `5ef75c4e7eaaf6a3c8df03c09529ee8b62609eb0c79ead94cb043c627380d405`, all cleanup `CLEAN` | Exact reconciled implementation source; not deployment                      |
| Git integration                     | Published `fe5e18eb` to canonical main after containing `0ded9be4`; fetch verified `HEAD...origin/main = 0/0`                                                                                                                                             | Accepted source integration and remote parity                               |

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

After owner acceptance, three source-bound 33-suite gates exercised the
concurrent-main reconciliation rule. Source `8e81b3ba` passed 33/33 receipts and
1,295 selected cases before accepted Tideglass main invalidated its catalog and
test-inventory evidence. Source `9407c71d` then passed 33/33 and 1,308 selected
cases before accepted One Voyage catalog reconciliation invalidated its source
identity. Final source `fe5e18eb` incorporated that interval, passed the 33/33
gate shown above, and was the source published to canonical main. No concurrent
authority was interrupted; the shared lock and port handoffs were coordinated
with Tideglass, Wakebook, Shipwright, and Deepwater.

Before integration, Deepwater correctly treated Admiralty as branch-only
coordination input. After `fe5e18eb` reached main, Phase 3 includes its platform
administration and consented Support Access capability in the accepted-main
denominator. The historical Phase 2 trace remains unchanged; this status
promotion does not start a new Deepwater or Admiralty phase.

## Canonical-state safety

Fixture preparation records
`C:\Users\kkids\Documents\Codex_TreasureHunt\prisma\dev.db` as untouched. All
database migration, browser, and walkthrough work uses a fresh task-owned path
below `%LOCALAPPDATA%\ProjectAdmiralty`. Bootstrap unit coverage is synthetic;
no bootstrap commit was run against canonical or deployed data.

## Retained limits

- owner walkthrough is complete and the owner decision is `ACCEPTED`;
- the accepted Phase 1 source is on canonical main but is not deployed;
- production MySQL migration/application behavior is not established by local
  SQLite rehearsal or schema parity;
- live providers, physical devices, and physical assistive technology remain
  external;
- Phase 2 and all later command-center capabilities were not started.
