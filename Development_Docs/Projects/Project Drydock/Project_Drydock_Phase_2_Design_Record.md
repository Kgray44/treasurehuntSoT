---
title: Project Drydock Phase 2 Design Record
audience: engineering
status: active
canonical_for: project-drydock-phase-2-design
last_reviewed: 2026-08-10
---

# Project Drydock Phase 2 design record

Phase 2, **Sound the Hull**, is active from accepted `origin/main` base `4a0f803a8ac4c238dc875da07df3cf0d1a5c81a3`. It extends the accepted Phase 1 authoring-contract foundation with whole-Chronicle static analysis. It does not start Phase 3 simulation or mutate a live Chronicle Session.

## Implemented authority

- `BlockConnection` is the only graph-edge authority. Legacy target fields are compatibility mirrors only.
- Graph proof includes entry reachability, terminal reachability, SCCs, and closed-loop detection.
- State proof is bounded definite-initialization dataflow with unused-state diagnostics. A bound exhausts to `INCOMPLETE_PROOF`; uncertainty is never presented as success.
- Condition feasibility classifies only typed Boolean expressions that are provably constant from immutable declared defaults; free-form legacy edge predicates remain explicitly unproven.
- Side-effect analysis flags duplicate artifact/outcome risk and repeatable grant, completion, or provider-request effects in cyclic graph components. It does not execute effects or replace One Voyage idempotency.
- Performance analysis is bounded and configuration-only: it warns before graph, variable, fan-out, expression, and static complexity review thresholds without making device or provider-runtime claims.
- Full validation consumes an immutable Studio draft plus asset snapshot. Asset metadata absent from a full survey produces an incomplete-proof issue.
- Reports are source-checksummed, digest-bound, diffable by stable issue identity, and persist as the latest draft validation summary. Creator and support projections are distinct.
- Repairs are preview-only until applied through an owning editor transaction. The only current automatic repair synchronizes legacy target mirrors from canonical edges, guards exact source checksum, and returns an inverse preview for undo.
- Waivers are rule- and source-bound. Current error rules are non-waivable; only explicitly reviewable warning rules may be authorized.

## Current integration

The existing Creator-authorized Studio validation route runs `FULL` Drydock analysis. Each exact-source report is retained as an immutable `DrydockValidationRun` receipt without authored source text and records its autosave source revision, while the draft keeps its latest summary. Owner-authorized Studio routes list safe receipt metadata and retrieve the creator-safe projection of a receipt. Owner-only, `private, no-store` graph and variable-survey routes project canonical topology, static annotations, variable use/initialization facts, and Creator-private defaults without creating a second graph authority or telemetry payload. The existing validation panel provides an accessible nonvisual graph outline and variable explorer with Passage navigation, alongside stable Drydock rule codes and catalog-backed detail (severity, repair class, waiver policy, and compatibility). It remains Shipwright-owned interaction infrastructure. Administrator-only waiver creation resolves a reviewable warning from an immutable owner-scoped receipt, rechecks its rule policy, and stores a source/revision-bound audit record; this does not delete or suppress the issue. Administrator-only revocation marks only an active waiver within the owning Chronicle as revoked, never deletes it, and keeps later source/rule evaluation fail-closed. Publication revalidates the exact draft, requires a complete error-free Drydock report, and then retains the existing autosave-version freshness guard before it writes an immutable version.

## Deliberate limits

This is an active implementation record, not a completion receipt. The executable rule catalog now covers every current static issue code, including typed-expression diagnostics, with versioned metadata and generated JSON. Repair UI, graph-canvas integration, the full synthetic corpus, broader Sounding Line registration, final reconciliation, and protected acceptance remain unfinished. Phase 3 simulation, scenario execution, virtual time, and runtime mutation remain **NOT STARTED**.
