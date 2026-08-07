---
title: Project Homeport Community Rating and Save Aggregation Contract
audience: product-engineering
status: current
canonical_for: project-homeport-community-rating-save-aggregation-contract
last_reviewed: 2026-08-05
---

# Project Homeport Community Rating and Save Aggregation Contract

## Scope

Authoritative aggregates. This contract repairs Round 2 realization while preserving specialist domain authority and prior accepted Homeport contracts.

## Required behavior

- Save count derives from unique active save records and changes on save/unsave.
- Average and rating count derive from eligible published reviews under the accepted moderation/removal policy.
- Duplicate saves and duplicate active ratings do not count; mutations and reconciliation yield the same aggregate.
- Zero ratings render an unrated state, never fabricated values or zero stars.

## Verification

- save/review IDOR and uniqueness
- create/update/delete/moderation
- aggregate reconciliation
- card/detail parity

## Truth boundary

Architecture freeze records the contract only. Implementation, evidence, Sounding Line release authority, and the owner's independent decision remain pending. No merge, deployment, live-provider proof, or owner acceptance is established.
