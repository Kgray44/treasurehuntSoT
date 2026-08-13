---
title: Project Sounding Line v1.4 Prompt 1 Design Record
audience: engineering
status: shadow-foundation
canonical_for: sounding-line-v14-prompt-1-design
last_reviewed: 2026-08-13
---

# Project Sounding Line v1.4 Prompt 1 Design Record

## Authority boundary

All Prompt 1 outputs are `SHADOW`, `OPTIONAL`, `ADDITIVE`, and
`NONAUTHORITATIVE`. They are not read by the v1.3 planner, finalizer, protected
binding, workflows, or protected check. `RELEASE_GO` remains exclusively the
current finalizer's decision. This implements the preparation boundary for
SL14-AC-001, SL14-AC-002, and SL14-FR-002 without activating them.

## Evidence and semantic identity

`EvidenceFingerprintV1` has a canonical JSON SHA-256 identity. It records suite
and protected contract IDs, source and contract closure digests, test/fixture,
schema/migration, dependency/toolchain/browser/runtime, policy/authority,
adapter/resource declaration, and original source/tree identities. Object,
path, contract, metadata, and resource ordering are canonicalized before
hashing. A closure reports `INCOMPLETE` and `UNKNOWN_REQUIRES_EXECUTION` when a
known subset cannot prove completeness; it never calls that subset preserved.

The decision vocabulary is `FRESH_REQUIRED`, `PRESERVED`, `REBOUND`,
`INVALIDATED`, `UNKNOWN_REQUIRES_EXECUTION`, `INCOMPATIBLE`, `EXPIRED`, and
`CORRUPT`. Every decision binds the prior receipt/fingerprint, candidate
fingerprint, changed interval, changed paths/contracts, dependency comparison,
and reason codes. A lineage claim is immutable and points to the original
receipt; rebound claims derive from it rather than replacing it. This is the
Prompt 1 foundation for SL14-EP-001, SL14-EP-002, SL14-SI-001, SL14-SI-002, and
SL14-SE-001.

Legacy analysis classifies evidence as `RECONSTRUCTABLE`,
`PARTIALLY_RECONSTRUCTABLE`, `RERUN_REQUIRED`, or `INCOMPATIBLE`. Missing test,
runtime, schema, policy, or immutable identity remains rerun-required, even
when the old result was green (SL14-LE-001, SL14-LE-002).

## Impact and comparison

The shadow impact representation contains affected paths/contracts, mapping
confidence, risk floor, selected suites, mapping-debt contracts, and a reason
ledger. Known mappings select the smallest closure plus an explicitly supplied
sentinel spine. Unknown paths, unmapped contracts, or mapping debt expand to
the current legacy mandatory set. Unknown can never omit proof.

`v14-shadow-plan.mjs` compares the unchanged v1.3 plan with the proposed v1.4
shadow plan. It gives each current or conditional suite a selected/omitted
state, evidence disposition, reason codes, risk floor, and mapping confidence.
An unexplained lost v1.3 obligation is `SHADOW_UNSAFE`. The pending configurable
spine is represented as input, not fixed authority. This addresses
SL14-IM-001, SL14-IM-002, and SL14-SM-001.

## Prepared layers and cleanup

Prepared manifests are content-addressed immutable inputs: layer type/version,
identity inputs, producer, platform, content manifest/digest, verification, and
`mutable: false`. Dependency identity accepts lock, Node/npm policy, OS/arch,
and install flags; Prisma accepts dependency/schema/generator/platform inputs;
browser and SQLite baseline identities use the same complete-input pattern.
Content is rehashed on restore, so a cache-key match alone is insufficient.
Working SQLite databases, browser profiles, ports, writable roots, build output,
and test workspaces are rejected as layers and remain run-owned.

Cleanup manifests record resource identity/type, lease owner, allocation,
created identity, cleanup action/time, final state, and result. Validation
rejects missing cleanup, wrong owners, survivors, duplicate IDs, and malformed
records. These are SL14-PL-001, SL14-PL-002, and SL14-PB-002 foundations.

## Tree and train primitives

Tree identity records commit/tree/base/candidate/resulting-tree identities and
merge method. Tree equality intentionally compares tree SHA, not commit SHA.
The local prototype uses `git merge-tree --write-tree` plus deterministic,
unreferenced synthetic commits in a caller-supplied isolated repository. It
records parent state, candidate, result, and conflict state; it neither pushes
refs nor touches GitHub/main. Candidate withdrawal returns the bounded
invalidation suffix. This prepares SL14-TI-001, SL14-MT-001, and SL14-MT-002.

## Compatibility strategy

Prompt 1 does not alter current receipts or acceptance. Existing v1.3 receipts
remain historical evidence. They may only be reconstructed into a v1.4 shadow
fingerprint from complete immutable facts; otherwise the shadow result is
rerun-required. Prompt 2 must reconcile all field names, gates, spine policy,
coverage thresholds, trust boundaries, and final authority consumption against
the final governing amendment.
