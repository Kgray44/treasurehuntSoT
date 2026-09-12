---
title: Voyagewright Refit V1
audience: product-engineering
status: current
canonical_for: voyagewright-refit-v1-control-area
last_reviewed: 2026-09-12
---

# Voyagewright Refit V1

## Owner-Directed Experience Redesign

**Purpose:** selective redesign of existing product areas under direct owner guidance.

Voyagewright Refit V1 is a controlled way to rethink one coherent product area at a time. It establishes the packet, review, preview, acceptance, and validation records needed for rapid owner-directed iteration; it does not authorize a redesign by itself.

## Baseline and relationship to Brightwork

Brightwork remains complete. Refit V1 begins from the accepted post-Brightwork product baseline. A Refit finding or redesign decision does not retroactively reopen Brightwork unless an independent, genuine Brightwork regression is proven.

The current protected baseline and its source-bound Brightwork evidence are inputs to a future packet. They are not a standing instruction to alter a page.

## Canonical records

- [Muster design packet](muster/design-packet.md) — MAJOR_STRATEGY_RETHINK, IMPLEMENTATION_ITERATING; [iteration 1 proof](muster/iteration-1-proof.md), [iteration 2 source mapping and review routes](muster/iteration-2-delta.md), and [iteration 3 positioning/composer delta](muster/iteration-3-delta.md). Owner acceptance remains pending.

- [Refit registry](refit-registry.json) — machine-readable area inventory, treatment, lifecycle, branch, and protection state.
- [Preview runbook](preview-runbook.md) — the fast, isolated local iteration loop.
- [Design packet template](templates/design-packet.md) — authoritative written direction for one area.
- [Iteration delta template](templates/iteration-delta.md) — a minimal, preservation-first owner change request.
- [Owner acceptance template](templates/owner-acceptance.md) — the only record that may establish design acceptance.

Create an area packet before implementation. Keep its branch, registry entry, evidence pointers, and acceptance record aligned as the area progresses.

## Area model

Each coherent redesign area has one dedicated worktree and one branch from current protected `main`, normally named `refit-v1/<area-slug>`. A branch may include closely related pages only when they share a shell and design strategy. Owner deltas remain on that same branch until acceptance; do not create a branch per visual adjustment or a single long-lived branch for all Refit work.

The registry supports these treatments:

- `REFERENCE_QUALITY` — terminal protection classification; not a redesign request.
- `LOCAL_POLISH`, `MODERATE_REDESIGN`, `MAJOR_STRATEGY_RETHINK` — only after the owner records direction.
- `UNASSESSED` — the required state when no direction or evidence-backed classification exists.

The lifecycle is `PLANNED` → `OWNER_DIRECTION` → `CONCEPT_ITERATING` → `CONCEPT_APPROVED` → `IMPLEMENTATION_ITERATING` → `OWNER_ACCEPTED` → `FINAL_VALIDATION` → `MERGED`, with `PAUSED` available where needed. `REFERENCE_QUALITY` is protected through its treatment field, not treated as a redesign lifecycle.

## Authority and iteration rules

Codex implements the written packet and narrowly applies owner deltas. During `IMPLEMENTATION_ITERATING`, Codex may expose the preview, preserve existing working behavior, and raise implementation constraints. Codex may not invent a major direction, replace an owner-approved concept, broaden to adjacent routes, or mark an area `OWNER_ACCEPTED`.

Only explicit owner feedback recorded in the [owner acceptance record](templates/owner-acceptance.md) may make the `IMPLEMENTATION_ITERATING` → `OWNER_ACCEPTED` transition. Concept images can communicate visual direction, but the written packet remains authoritative for behavior and exact content.

## Protection and final validation

`REFERENCE_QUALITY` areas are visual references, not incidental redesign targets. Before merging a shared-component change that reaches a protected area, explicitly review that area and record the result in the applicable packet or validation record.

Final validation starts only after owner acceptance. It covers applicable desktop, materially distinct tablet, mobile, Dark/Light behavior, responsive overflow, populated and empty/loading/error states, keyboard/focus, accessibility, reduced motion, representative data, route continuity, current screenshots, and focused regression proof. The [preview runbook](preview-runbook.md) distinguishes that gate from lightweight iteration checks.

Owner acceptance is design authority. Sounding Line remains verification and protected-merge authority. An area is `MERGED` only when owner acceptance, Sounding Line acceptance, and protected merge all exist.
