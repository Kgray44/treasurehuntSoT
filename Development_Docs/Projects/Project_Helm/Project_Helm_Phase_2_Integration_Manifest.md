---
title: Project Helm Phase 2 Integration Manifest
audience: product-engineering
status: current
canonical_for: project-helm-phase-2-integration-manifest
last_reviewed: 2026-08-12
---

# Project Helm Phase 2 integration manifest

## Evidence boundary

This manifest records the completed protected-mainline integration for **Read
the Deck**. It claims repository acceptance and retained automated proof only;
it is not deployment, a live-provider result, physical-device proof, or owner
acceptance.

| Field                       | Accepted value                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Original phase base         | `4a0f803a8ac4c238dc875da07df3cf0d1a5c81a3`                                                                              |
| Initial Phase 2 integration | Pull request 35; candidate `16368d43dbb46b29d65797f2cf938dc9a9e701fc`; merge `ca40227cbef3575315c089d224a0cd26ec77bc78` |
| Current-main repair branch  | `codex/project-helm-invitation-handoff-repair`                                                                          |
| Current-main repair base    | `5735d43821209adb2259ec2c38979281da1bb5b9`                                                                              |
| Frozen final candidate      | `61cb6e0fc8df4bf8b5a38cc14f3f1bc715d8ee00`                                                                              |
| Final protected integration | Pull request 53; merge `920d92a51a16d60a2dfe35278598e6d921be7e4c`                                                       |
| Accepted Helm integration   | `920d92a51a16d60a2dfe35278598e6d921be7e4c`                                                                              |
| Current mainline state      | `MAINLINE_ACCEPTED`                                                                                                     |

## Intended additive surface

The accepted source adds the Platform-owned `MembershipPresenceDevice` source;
paired SQLite/MySQL migrations; authenticated Player heartbeat transport;
privacy-safe Captain operational, crew, event, and Library projections; and
read-only current-progress summaries. It preserves Phase 1 Captain authority,
ordinary Player membership, Captain commands, TaleSession lifecycle/progression,
and the compatibility-only aggregate heartbeat field.

## Reconciliation result

The post-Phase-2 current-main interval through `5735d438` contained Bridgewatch
completion records and Sounding Line workflow-retirement work. It did not
change Helm's operational projection source, Prisma schema or migrations,
Captain authorization, membership-presence contract, or persisted product
model. The earlier Phase 2 authority remains historical evidence, but cannot
serve as acceptance for a different candidate/base identity.

The targeted reconciliation exposed one genuine Helm failure family in the
hosted `browser.helm` journey: after a successful invitation acceptance, a soft
navigation could remain on `/player/invitation`; separately, concurrent
heartbeats could leave the Captain projection short of four fresh synchronized
members. The repair gives the successful handoff a bounded document-navigation
fallback and timestamps presence when persistence occurs under the write queue.
It does not add a command, a new authority model, or Phase 3 behavior.

The final documentation-format commit changed only two Bridgewatch records. It
invalidated `static.core` evidence and was requalified as that focused scope;
it did not invalidate the already-passing Helm browser evidence. No unrelated
product suites were rerun merely because the candidate SHA changed.

## Accepted integration evidence

Focused hosted `browser.helm` run
[`31606851534`](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31606851534)
passed 3/3 on the behavioral repair, candidate
`bf03b0811eada44f6f9db56858b76e7c778e1d81`, with `CLEAN` teardown. Focused
hosted `static.core` run
[`31613621741`](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31613621741)
then passed on final candidate `61cb6e0f` with `CLEAN` teardown.

Hosted Sounding Line mainline run
[`31614127435`](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31614127435)
ran final candidate `61cb6e0f` against base `5735d438` and returned
`RELEASE_GO`. Its 38 mandatory receipts passed with clean teardown; missing,
duplicate, unknown, invalid, and runtime-conformance evidence sets were empty.
Plan digest:
`ace45a6a6a42a0aedbcd42246bcc055bb83e5d5032e0f94f27ad2063b7d612b0`.
Evidence digest:
`19b4637132ac199640dd20415c4ff2df48f802b6497834934a8e72a2a0f3e105`.

Merge `920d92a51a16d60a2dfe35278598e6d921be7e4c` has exact parents
`5735d43821209adb2259ec2c38979281da1bb5b9` and
`61cb6e0fc8df4bf8b5a38cc14f3f1bc715d8ee00`. Its tree
`8cd77b00188b23bfcddf46380eb427a97e0ec274` matches a fresh
`git merge-tree --write-tree` recomputation. Protected merge-binding run
[`31616473977`](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31616473977)
passed against the sealed `RELEASE_GO` envelope. At the product-integration
check, remote parity was
`origin/main = 920d92a51a16d60a2dfe35278598e6d921be7e4c`.

## Current-main corrective requalification

The documentation-closure candidate at `58c44255e92679637b8cee616ea19cb89be27026`
reached an `EVIDENCE_INVALID` Mainline Decision in
[run 31622810342](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31622810342).
The sole invalid suite was `browser.helm`: invitation acceptance returned 400
because Prisma's default five-second interactive transaction expired while
committing the atomic membership handoff. The governed worker completed its
cleanup, the finalizer was terminal, and acceptance ownership was released.

Commit `bd89d2078f057a0821b271143ac26afa46b34797` retains that atomic handoff
but bounds it with a 5-second acquisition wait and a 15-second execution
timeout. Exact task-owned local `browser.helm` evidence then passed all three
registered cases, including the previously failing invitation journey, with
`CLEAN` teardown. This is an ordinary Phase 2 corrective fix: it adds no
migration, command, authority model, or Feature Catalog capability. A fresh
hosted focused receipt and exact protected-main authority remain required for
the replacement candidate.

Focused hosted `browser.helm` run
[`31628039327`](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31628039327)
then failed on reconciled candidate `600fff64488054cb98da40d78596c1617142abd2`,
with `CLEAN` teardown. The invitation acceptance had completed; the first
journey exposed a distinct background-tab race in which a Player tab could
receive focus before its visibility state settled, return early from
reconciliation, and remain at the waiting-room route after launch. Commit
`59aaa279073ad3d1a86e1127b1dae643e6de7b2b` adds one zero-delay visible-state
recheck and direct regression coverage. Its focused component test passed
14/14, exact task-owned `browser.helm` passed 3/3 with `CLEAN` teardown, and
focused `static.core` passed with `CLEAN` teardown. This remains a Phase 2
corrective repair with no migration, command, authority-model, or Feature
Catalog capability change. A new frozen candidate requires one hosted focused
browser receipt and one exact protected-main authority decision.

## Explicit exclusions

Phase 2 does not add a duplicate Voyage state machine, Chronicle event store,
command engine, preflight engine, recovery tooling, provider fallback, or
progression mutation from a read. Phase 3 Action Rail/command redesign and all
Phase 4 work remain intentionally absent.
