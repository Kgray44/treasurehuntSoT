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

## Explicit exclusions

Phase 2 does not add a duplicate Voyage state machine, Chronicle event store,
command engine, preflight engine, recovery tooling, provider fallback, or
progression mutation from a read. Phase 3 Action Rail/command redesign and all
Phase 4 work remain intentionally absent.
