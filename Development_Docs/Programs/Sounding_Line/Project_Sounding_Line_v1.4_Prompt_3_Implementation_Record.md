---
title: Project Sounding Line v1.4 Prompt 3 Implementation Record
audience: engineering
status: local-nonauthoritative-qualification
canonical_for: sounding-line-v14-prompt-3-implementation
last_reviewed: 2026-08-13
---

# Project Sounding Line v1.4 Prompt 3 Implementation Record

Prompt 3 adds only the explicit `SHADOW_OPTIONAL_ADDITIVE_NONAUTHORITATIVE` v1.4 path. It does not import v1.4 code from current v1.3 authority, does not alter a workflow default, and cannot emit `RELEASE_GO`.

## Implemented machinery

- `scripts/sounding-line/v14/fast-channel.mjs` provides canonical sealed artifacts, a durable exclusive-write JSON evidence store, receipt/derivation lineage, current-producer resolution, export/import, sealed impact plans, risk floors, release closure, local host-neutral immutable layer transport, worker preparation, cleanup-aware v1.4 finalization, lightweight provenance binding, typed recovery routes, and legacy adoption records.
- `scripts/sounding-line/v14-fast-channel.mjs` creates a real-Git shadow plan carrying distinct candidate/base commit and tree identities, predicted parent/tree identities, mapped changed paths, policy/inventory digests, selected nodes, and an omission ledger.
- `scripts/sounding-line/worker-preparation.mjs` retains its v1.3 function byte-for-byte in behavior and adds a separately exported, version-gated v1.4 preparation entry point. It refuses any plan outside the v1.4 shadow boundary.
- `testing/v14/legacy-evidence-compatibility.json` is the explicit v1.3-to-v1.4 compatibility table. Missing identities, policy/schema incompatibility, or prohibited assumptions produce adoption refusal/fresh or conservative work rather than promotion.

## Security and transport posture

The layer transport uses exact content-addressed identity directories. It accepts only trusted producers, `CLEAN` scan state, immutable manifests, and a byte-for-byte rehash before and after restore. A miss selects normal governed preparation; corruption or trust failure throws and never supplies evidence. SQLite and every other mutable resource remain run-owned preparation inputs, never layer content.

The local filesystem provider is deliberately host-neutral: the manifest, content rehash, consumer constraints, trust gate, and return contract do not expose a host-specific cache key or restore prefix. GitHub hosted publication and cross-run cache policy remain an operational transport activation task; no unverified hosted performance claim is made in Prompt 3 local qualification.

## Deferred boundaries

Prompt 4 still owns ordered train planning, replan boundaries, and actual landed-tree comparison. Prompt 5 still owns hosted controlled performance proof, paused-fleet evidence adoption, shadow corpus, authority cutover, protected binding activation, and rollback.
