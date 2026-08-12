---
title: Project Admiralty Phase 2 Provider Status Architecture
audience: product-engineering-security-operations
status: current
canonical_for: project-admiralty-phase-2-provider-status
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 2 provider status architecture

Phase 2 presents provider truth without synchronously probing external systems
on ordinary page render and without exposing credentials or owner-private
configuration.

| Category                           | Canonical source                        | Phase 2 representation                                                                               |
| ---------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Community delivery/operations      | Harborlight sanitized health projection | Current safe state, observation/freshness, safe failure meaning                                      |
| Private storage/scanner/key/backup | Sealed Hold sanitized health projection | Provider and queue state, backup freshness, latest restore drill                                     |
| Transactional email                | Wayfarer configuration presence only    | `CONFIGURED`/`NOT_CONFIGURED` plus `BLOCKED_BY_MISSING_OWNER_CONTRACT`; no delivery-health inference |
| Verification                       | Wayfarer request state only             | `NOT_LIVE_VALIDATED` or missing-contract state; no fabricated provider evidence                      |
| Build/release                      | Sounding Line/runtime identity          | Source-bound build and validation state, not deployment authority                                    |

All provider cards use the shared operational vocabulary: `IMPLEMENTED`,
`CONFIGURED`, `NOT_CONFIGURED`, `LIVE_VALIDATED`, `NOT_LIVE_VALIDATED`,
`HEALTHY`, `DEGRADED`, `UNAVAILABLE`, `STALE`, `EXTERNAL_PENDING`, and
`UNKNOWN`. Each includes source, environment, observed time, freshness, last
success, and a sanitized failure code.

The only cache is a 30-second process-local read optimization. It contains the
same sanitized DTO, is not persisted, and is never authority. On refresh
failure the UI keeps other providers usable and labels the affected value
unavailable or stale. Phase 2 exposes no provider reconfiguration, retry,
repair, backup, restore, release, or credential control.
