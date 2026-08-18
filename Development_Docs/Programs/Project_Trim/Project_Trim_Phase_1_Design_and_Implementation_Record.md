---
title: Project Trim Phase 1 Design and Implementation Record
audience: engineering
status: current
canonical_for: project-trim-phase-1-design
last_reviewed: 2026-08-14
---

# Project Trim Phase 1 - Set the Watch

## Authority and scope

The governing baseline is `Development_Docs/Governing/Project_Trim_Codex_Context_and_Inference_Efficiency_Governing_Document_v1.0-R1.pdf` (SHA-256 `8968C3FEE301F83B89A8F2AB0350FFE9B32089262AFC3CBB3EADC8D2CDD728A6`). It is an exact byte-for-byte copy of the supplied PDF. Phase 0 records in this directory are preserved evidence, not governing authority.

Phase 1 adds a small permanent workflow, seven startup profiles, a Node MSCP generator, task-local JSON/Markdown packet projection, basic blob-aware read/expansion ledger, and exact/first-order token usage records. It composes existing testing registries and Git identities; it creates no competing ownership, contract, suite, resource, release-gate, authority, debt, or document-index registry.

## Operational boundary

`scripts/agent-context/build-context.mjs` writes derived packet and ledger files to `.agent-context/` by default. Packets identify source state, authority pointers, ownership/contracts, source/schema/verification slices, risk/debt/mapping gaps, completion contract, confidence, and conservative fallback. Sounding Line remains the only verification/release authority and product behavior is unchanged.

Phase 2 features (complete staleness, capsules, full digest/search ledger, subagent slicing, model routing, dashboards, and broad history ingestion) are not started.
