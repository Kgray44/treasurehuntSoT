---
title: Project Admiralty Phase 2 Design Record
audience: product-owner-engineering-security-operations-support
status: current
canonical_for: project-admiralty-phase-2-design
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 2 design record

## Decision

Phase 2, **Open the Chartroom**, is a Class B read-only vertical slice based on
accepted mainline `468530645e983412e5f4c1aaa103915be77c9c07`. It expands the
accepted Phase 1 authority into a mature administrative workspace without
creating canonical business truth or broad administrative mutations.

## Authority and read ports

| Domain                                                            | Canonical owner | Admiralty responsibility                                                                    |
| ----------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------- |
| Accounts, profiles, email, sessions, OAuth, security, lifecycle   | Wayfarer        | Bounded search, safe summaries, support-gated diagnostics, human-readable security evidence |
| Chronicles, immutable editions, Voyages, crew, progression events | One Voyage      | Search and typed operational inspection without private or unrevealed content               |
| Community listings, releases, reports, cases, sanctions, appeals  | Harborlight     | Read-only workload and content-owner projections without moderation commands                |
| Private assets, storage, scanner, key and backup providers        | Sealed Hold     | Provider and operational metadata only; no decrypted content or credentials                 |
| Verification and release evidence                                 | Sounding Line   | Source-bound status and evidence links; no duplicated release authority                     |
| Capability realization                                            | Deepwater       | Consume findings and record a Phase 2 disposition; do not duplicate its audit ledger        |

## Architecture

The implementation uses narrow typed adapters and projections grouped by
owner domain. Federated search executes bounded domain queries in parallel and
returns explicit per-domain availability instead of failing the whole request.
Every result is capability-filtered before projection. Direct Prisma reads are
allowed only inside an owner-named adapter when no owner service port exists;
Prisma objects never leave that adapter.

Operational projections use a shared status vocabulary and include source,
environment, observed time, last successful observation, freshness, and a safe
failure code. The Provider directory does not synchronously fan out to external
services on ordinary page render; it consumes current canonical configuration
and last-known/local validation truth.

## Information architecture

The authorized shell provides persistent responsive navigation to Overview,
People, Chronicles, Voyages, Community, Operations, Providers, Configuration,
Releases, Audit, and Investigate. Dynamic details are contextual routes with a
visible parent and return path. Ordinary accounts continue to receive no
Admiralty navigation or privileged route projection.

Primary pages use human explanations, meaningful status, and safe next
navigation. Stable IDs, checksums, provider codes, timestamps, and correlation
IDs live in reusable technical-details disclosures with accessible copy
controls.

## Authorization and privacy

The Phase 1 named capabilities remain the authorization vocabulary. Navigation
is filtered for usability, while every page and API independently authorizes on
the server. Search is bounded, normalized, paginated, rate limited, and cannot
enumerate all people or secret-backed fields. `SECRET` is never returned.
`PRIVATE_PERSONAL_CONTENT` remains unavailable unless a later separately
governed scope exists.

Opening sensitive dossiers and support-gated reads is audited according to the
Phase 1 risk policy. Aggregate dashboard refreshes are not individually audited
to avoid evidence noise.

## Deepwater preflight

- Harborlight Community operations health has an accepted sanitized source and
  is eligible for `REALIZED_IN_PHASE_2` through an Admiralty consumer.
- Sealed Hold private-provider health has an accepted sanitized source and is
  eligible for `REALIZED_IN_PHASE_2` through an Admiralty consumer.
- Transactional email health remains `BLOCKED_BY_MISSING_OWNER_CONTRACT` until
  Wayfarer exposes an authenticated sanitized operator projection.
- Real verification-provider evidence remains `BLOCKED_BY_MISSING_OWNER_CONTRACT`
  or external evidence; Admiralty may truthfully show that absence but may not
  fabricate a provider result.

## Acceptance boundary

This is major product-facing work. Automated readiness, local synthetic data,
browser automation, and Sounding Line evidence cannot self-accept it. The phase
must stop at `PROJECT ADMIRALTY PHASE 2 — READY FOR OWNER WALKTHROUGH` until the
owner explicitly accepts the running experience. Only then may governed
canonical-main integration proceed. Phase 3 must not begin.
