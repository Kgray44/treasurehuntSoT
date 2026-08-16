---
title: Sounding Line v1.4 Bounded Mixed-Browser Batching Repair Plan
status: active
classification: engineering-plan
program: Sounding Line
version: 1.4
date: 2026-08-16
---

# Sounding Line v1.4 Bounded Mixed-Browser Batching Repair Plan

## Trigger and boundary

The only normal candidate authority run for Bridgewatch v1.2 candidate
`71b1411b1e2b4c80604d56ae0e219a3b4eb127c7` was run `31978353871`. Its
sealed plan completed, but physical worker batching rejected registry-selected
browser cases which require both Chromium and WebKit. The plan workflow then
coerced the failed command output into `{"include":[null]}`, so Wave 0 correctly
failed before product execution. This repair changes only Sounding Line's
physical scheduling and evidence transport. It does not change Bridgewatch
product behavior, ordinary-candidate policy, the authority decision model,
browser-resource requirements, or protected binding.

The relevant sealed-plan distinction is intentional: a logical suite remains
one obligation and must produce one logical receipt, while its exact selected
browser cases may require more than one compatible physical browser worker.

## Implementation sequence

1. Extend the sealed hosted plan with deterministic browser-engine partitions
   derived solely from each node's already selected registry case identifiers.
   Each partition must have one known engine, non-empty exact case ids, and the
   partitions must be a lossless, duplicate-free cover of the node's existing
   `testIds`. Reject unknown, missing, duplicate, or mixed browser requirements.

2. Make `physical-worker-batching.mjs` expand a multi-engine logical browser
   suite into one valid physical batch per sealed engine partition. Preserve the
   logical `suiteIds` and `suiteIdsJson` contract, carry the sealed case subset
   and a unique physical batch id, keep PR #147's Node batching unchanged, and
   emit only concrete objects. Empty input remains an empty include array; the
   authority workflow alone converts that into its existing explicit empty-wave
   marker.

3. Pass the physical browser partition and unique receipt-artifact identity
   through the normal and mainline-train reusable worker matrices. The governed
   worker restores exactly its one declared browser layer, executes only the
   sealed subset for that engine, and validates the physical receipt boundary.
   Browser-family execution must reject a requested subset that is not an exact
   registry selection for the supplied engine.

4. Reconstruct one logical receipt only in the finalizer. It must accept the
   complementary sealed physical partitions exactly once, require their union
   to equal the pre-existing logical `testIds`, retain all source, plan,
   inventory, gate, cleanup, and runtime-conformance checks, and reject missing,
   duplicate, foreign, or mismatched physical evidence. The final decision and
   logical suite identity remain unchanged; the evidence closure covers the
   physical receipts as well as their logical projection.

5. Harden normal-authority matrix construction: check the batch command exit
   status before JSON parsing, require a non-empty concrete `include` array
   element shape when work exists, and reject a null or malformed entry before
   publishing any GitHub matrix output. Wave barriers must independently reject
   malformed matrices while continuing to accept valid partitioned work and the
   existing explicit empty marker.

## Test-first validation

Add focused regressions before implementation and observe each failure:

- Chromium-only and WebKit-only physical batches preserve current behavior.
- Mixed logical browser work becomes independent Chromium and WebKit batches
  with the same logical suite identities and exact, disjoint selected case ids.
- Empty input remains empty for the caller marker contract, no generated matrix
  can contain a null element, and unknown or incompatible browser requirements
  fail closed.
- The Wave 0 barrier accepts a valid partitioned matrix and rejects a null
  matrix element; PR #147 JSON-array transport and multi-receipt boundaries
  remain intact.
- Finalization accepts only a complete complementary partition set and produces
  the original logical receipt identity; incomplete or duplicate partition
  evidence is invalid.

Run the focused batching, topology, runtime-conformance, planner, finalizer,
and workflow-contract tests, followed by the full Sounding Line unit regression
required for this authority-sensitive maintenance repair. Run documentation and
feature-catalog validation before publishing. The repair is integrated through
its own Sounding Line authority-maintenance change. Only after it is on
protected main may Bridgewatch PR #160 be reconciled, requalified, dispatched
once as a new normal candidate authority run, normally bound, merged, and
verified on exact protected main.
