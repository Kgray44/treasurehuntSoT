---
title: Project Helm Phase 2 Validation Record
audience: product-engineering
status: current
canonical_for: project-helm-phase-2-validation-record
last_reviewed: 2026-08-12
---

# Project Helm Phase 2 validation record

## Current decision

**CURRENT-MAIN REQUALIFICATION IN PROGRESS.** The original Phase 2
implementation was accepted through pull request 35 as merge
`ca40227cbef3575315c089d224a0cd26ec77bc78`. After current-main reconciliation
and a focused Helm repair, protected pull request 53 accepted exact candidate
`61cb6e0fc8df4bf8b5a38cc14f3f1bc715d8ee00` against base
`5735d43821209adb2259ec2c38979281da1bb5b9` as merge
`920d92a51a16d60a2dfe35278598e6d921be7e4c`. Hosted Sounding Line run
[`31614127435`](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31614127435)
returned `RELEASE_GO`: all 38 mandatory receipts passed with clean teardown,
and there was no missing, duplicate, unknown, invalid, or runtime-conformance
evidence. That acceptance is historical evidence for the earlier exact source;
the current corrective candidate still requires its own focused hosted receipt
and one authoritative Mainline Decision.

## Current-main reconciliation and invalidation

The post-Phase-2 interval through current base `5735d438` included Bridgewatch
completion records and Sounding Line workflow-retirement work. It did not
change Helm's operational projection source, Prisma schema or migrations,
Captain authorization, membership-presence contract, or persisted product
model. Earlier authority receipts remained historical evidence, but no longer
constituted acceptance for a new candidate/base identity.

The reconciliation uncovered a real `browser.helm` failure family. After a
200 invitation acceptance, a soft navigation could remain on
`/player/invitation`; in a separate run, persisted heartbeats could still leave
the Captain projection short of four `CONNECTED_SYNCED:SYNCHRONIZED` entries.
The repair supplies a bounded document-navigation fallback and captures
presence freshness at persistence. Focused hosted `browser.helm` requalification
passed. The final documentation-only format change touched two Bridgewatch
records, invalidating `static.core` only; focused hosted `static.core` passed.
Helm browser evidence was retained, and unrelated suites were not rerun merely
because the SHA changed.

The current-main record-only candidate then reached terminal
`EVIDENCE_INVALID` in run
[`31622810342`](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31622810342)
because the atomic invitation-acceptance transaction exceeded Prisma's default
five-second execution window. Commit `bd89d207` bounds that transaction at a
15-second execution timeout and passed local exact `browser.helm` 3/3. Focused
hosted run
[`31628039327`](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31628039327)
then exposed a separate `CLEAN` background-tab handoff failure: a Player tab
could receive focus before `document.hidden` settled and never issue the
authoritative launch recheck. Commit `59aaa279` performs one zero-delay
visible-state recheck; the focused component regression passed 14/14, local
exact `browser.helm` passed 3/3 with `CLEAN` teardown, and focused
`static.core` passed with `CLEAN` teardown. No migration, command,
authority-model, or catalog capability changed.

## Final qualification evidence

| Lane                        | Result                                                                                                                         | Boundary                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Focused local Helm units    | 15/15 passed                                                                                                                   | Direct invitation-handoff and membership-presence repair coverage.                       |
| Focused local Helm browser  | 3/3 passed                                                                                                                     | Captain/Player invitation, heartbeat, projection, responsive, and accessibility journey. |
| Hosted focused Helm browser | [run 31606851534](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31606851534): 3/3 passed; `CLEAN`                    | Exact behavioral-repair qualification on `bf03b081`.                                     |
| Focused local static core   | Passed                                                                                                                         | Exact final formatting-reconciliation scope.                                             |
| Hosted focused static core  | [run 31613621741](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31613621741): passed; `CLEAN`                        | Exact final candidate `61cb6e0f`; no Helm browser invalidation.                          |
| Hosted mainline authority   | [run 31614127435](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31614127435): `RELEASE_GO`, 38/38 passed and `CLEAN` | Exact frozen candidate `61cb6e0f`; the sole final release and merge authority.           |
| Current corrective component | 14/14 passed                                                                                                                  | `PlayerVoyageRoom` focus-before-visibility handoff regression in `59aaa279`.              |
| Current corrective browser   | 3/3 passed with `CLEAN` teardown                                                                                              | Exact local `browser.helm` rerun after `59aaa279`.                                        |
| Current corrective static    | Passed with `CLEAN` teardown                                                                                                  | Focused `static.core` rerun after `59aaa279`.                                              |

The authoritative plan digest is
`ace45a6a6a42a0aedbcd42246bcc055bb83e5d5032e0f94f27ad2063b7d612b0` and
the evidence digest is
`19b4637132ac199640dd20415c4ff2df48f802b6497834934a8e72a2a0f3e105`.

## Integrated-main proof

The protected merge has exact parents
`5735d43821209adb2259ec2c38979281da1bb5b9` and
`61cb6e0fc8df4bf8b5a38cc14f3f1bc715d8ee00`. Recomputing the merge tree with
`git merge-tree --write-tree` produced
`8cd77b00188b23bfcddf46380eb427a97e0ec274`, identical to merge
`920d92a5`'s tree. Protected merge-binding run
[`31616473977`](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31616473977)
consumed the sealed `RELEASE_GO` envelope and passed. At the product-integration
check, `origin/main` resolved exactly to
`920d92a51a16d60a2dfe35278598e6d921be7e4c`, and the accepted candidate is an
ancestor of it.

## Scope and boundaries

Phase 2 adds the Platform-owned `MembershipPresenceDevice` source, authenticated
Player heartbeat transport, privacy-safe Captain operational/crew/event/Library
projections, and read-only progress summaries. It preserves Phase 1
Captain-only and Captain + Player relationships, ordinary Player projection,
existing Captain commands, history, and artifacts. It adds no duplicate event
source, no progression mutation from a read, no deployment claim, no
live-provider proof, no physical-device proof, and no owner-acceptance claim.
Phase 3 command redesign and Phase 4 preflight/recovery remain unstarted.
