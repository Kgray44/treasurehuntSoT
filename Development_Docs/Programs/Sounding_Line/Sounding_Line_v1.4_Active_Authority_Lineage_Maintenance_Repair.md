---
title: Sounding Line v1.4 Active Authority Lineage Maintenance Repair
audience: engineering
status: current
canonical_for: sounding-line-v1.4-active-authority-lineage-maintenance-repair
last_reviewed: 2026-08-18
---

# Sounding Line v1.4 active authority lineage maintenance repair

## Purpose

Protected binding retains every sealed acceptance envelope as historical evidence. It selects authority only from the current governed lineage; retention is not eligibility.

## Selection rule

The selector uses identity rather than run chronology:

1. one direct envelope for the exact PR head and current qualified base;
2. otherwise, one train envelope whose sealed plan predicts the current PR-head tree;
3. otherwise, one direct current-head lineage for the protected-binding semantic carry-forward check.

Byte-identical lineage evidence is deduplicated by its sealed identity. A changed candidate head, expired or revoked artifact, invalid sealed identity, stale train prediction, and untrusted workflow source are historical but not selectable. Two distinct eligible lineages or no eligible lineage fail closed with `SEALED_EXPLICIT_AUTHORITY_NOT_UNIQUE`.

## Scope boundary

This is a Sounding Line maintenance repair only. It does not change Drydock behavior, the protected `Sounding Line / Mainline Decision` context, release semantics, or historical evidence retention.
