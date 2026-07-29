# Project Wayfarer Phase 4 Implementation Record

## Scope delivered

Phase 4 establishes the personal Artifact Cabinet and achievement ledger on
`codex/project-wayfarer-phase4-artifacts-achievements`. The forward migrations
are `20260725120000_wayfarer_phase4_artifacts_achievements` for SQLite and
`0027_wayfarer_phase4_artifacts_achievements` for MySQL.

An `ArtifactGrantReceipt` is created immediately after the canonical
`artifactGranted` event commits. It keeps only schema-versioned, allowlisted
receipt evidence; raw event payload is not copied into Wayfarer. Recipient
policies resolve from the membership snapshot at event time. A correction is a
new receipt linked to its earlier grant; a revoked correction preserves the
historical record while changing its projected status.

## Boundaries

- One Voyage remains the authority for session events, memberships and shared
  inventory. Projection/reconciliation writes only Wayfarer tables.
- A historical shared-inventory event without a receipt produces at most an
  `UNRESOLVED` `WITNESSED` record. It never backfills ownership.
- Personal notes, Memory links, source receipt identifiers, and unlisted case
  tokens are owner-only. Public output contains only explicitly visible,
  active display items and explicitly showcased achievements.
- Unknown collection or assembly recipes are rendered as unavailable rather
  than inferred. 2D/3D representations always retain an accessible text
  fallback.

## Owner surfaces

`/api/passport/artifacts` materializes, filters, sorts and cursor-pages the
ledger. Detail and personalization are owner-scoped. Display-case operations
are owner-scoped and atomically replace ordered items. Achievement evaluation
uses versioned persisted definitions, storing a fact snapshot and revoking an
achievement when authoritative facts no longer qualify. The public
`/api/profile/[handle]/artifacts` route only projects cases and showcases that
both the case/achievement and individual artifact permit the viewer.
