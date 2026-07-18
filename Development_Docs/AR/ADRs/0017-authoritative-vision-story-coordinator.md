# ADR 0017: Authoritative Vision Story Coordinator

- Status: Accepted for Phase B-5 implementation
- Date: 2026-07-18

## Context

Phase B-5 must connect the B-4 local verification engine to Player, story, Captain, and Phase A presentation without allowing a browser or Companion to fabricate progression. Results can arrive late, twice, or after an offline interval. Published story bindings and waypoint packages must remain immutable.

## Decision

The shared application is the authoritative coordinator. It creates an attempt from the current published story state and immutable `VisionPublishedBinding`, selects the effective runtime mode, and issues a short-lived HMAC stage token bound to the attempt, Player, session, story, published story version, block, binding, waypoint version, package hash, Companion instance, story sequence, and mode.

The Companion installs a data-only B-4 package, validates its integrity, captures frames locally, runs the production B-4 engine, discards pixels, and returns a derived result. It cannot emit a canonical story event. The server validates identity, token, freshness, package, evidence counts, evidence digest, certification policy, and current story state before using the existing transactional verification/progression seam.

`SHADOW` never progresses from an engine result. `CAPTAIN_CONFIRMED` waits for an authenticated, permissioned, audited Captain decision. `AUTOMATIC` is effective only when both rollout flags are on, the immutable build is eligible, certification approves automatic operation, field evidence is `PASSED`, and no pause control applies. Any failed condition demotes to `CAPTAIN_CONFIRMED`.

Phase A remains the presentation owner. B-5 requests and acknowledges the existing presentation flow; it does not introduce a second cinematic engine.

Offline storage contains derived result metadata only. Reconciliation uses stable event and payload identities and surfaces stale story versions as conflicts.

## Consequences

- A client-side `VERIFIED` value is only untrusted input until authoritative validation completes.
- Valid duplicate delivery is idempotent; mismatched duplicate identity is rejected.
- Published bindings are copied to immutable per-publication rows and checked for mutation.
- Captain overrides and mode changes remain visible in durable decision, control, audit, and transition records.
- Automatic mode is structurally present but unavailable while the B-4 field-evidence prerequisite is incomplete.
- Recovery can independently disable Player integration, Captain integration, offline reconciliation, live external AR, or all automatic progression.

## Alternatives rejected

- Direct Companion-to-story progression would bypass current-stage and authorization checks.
- Browser-only progression would make fabricated results authoritative.
- Mutable story bindings would invalidate replay and audit evidence.
- A new reveal system would duplicate Phase A ownership and persistence.
