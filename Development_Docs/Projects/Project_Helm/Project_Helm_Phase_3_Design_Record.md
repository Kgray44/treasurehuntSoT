---
title: Project Helm Phase 3 Design Record
audience: product-engineering
status: current
canonical_for: project-helm-phase-3-design-record
last_reviewed: 2026-08-27
---

# Project Helm Phase 3 design record

## Scope and governing boundary

Phase 3, **Give the Orders**, turns the accepted read-only Captain operational
projection into a live, contextual command console. It wraps the existing
canonical Captain commands with current-state eligibility, preview, meaningful
confirmation, and a clear receipt. It does not introduce a second Voyage state
machine, event stream, command dispatcher, Captain authority source, or
Player-facing projection.

This phase consumes the v1.0 governing document after accepted P1, P2, A1, A2,
and A3. It deliberately stops before P4 **Weather the Passage**: there is no
new provider fallback, preflight engine, recovery workflow, device operation,
or external incident control plane.

## Frozen command and source matrix

| Concern                      | Canonical source                                                     | Phase 3 treatment                                                                                     |
| ---------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Captain authority            | `TaleSession.captainAccountId` with compatibility bridge             | Existing scoped Captain authorization gates every read, preview, and command.                         |
| Live lifecycle and sequence  | `TaleSession.status` and `currentSequence`                           | The console refreshes the authoritative projection and attaches a prepared sequence to every command. |
| Verification action          | Existing `captainSessionAction` and `submitVerification`             | Approve, request another attempt, and Captain override reuse the canonical verification paths.        |
| Presentation and hints       | Existing canonical Captain actions and `TaleSessionEvent`            | Replay and next-hint controls are available only when the current projection allows them.             |
| Passage movement             | Existing canonical jump and rollback actions                         | A Captain selects an allowlisted published Passage; the server rejects the current or unknown target. |
| Progress map                 | Immutable published snapshot plus canonical entered/completed events | The DTO carries titles, block type, relation count, and operational state only.                       |
| Crew, attention, and history | Accepted Phase 2 projection                                          | The console renders existing privacy-safe summaries without changing their authority.                 |

`CaptainCommandConsoleProjection` is an allowlisted addition to
`getCaptainVoyageProjection`. It contains command metadata, a map of published
Passages, and released/available hint counts. It cannot include Creator notes,
unpublished or hidden answers, raw configuration, variables, event payloads,
private Player memories/reflections, identity/session/device data, or raw
verification evidence.

## Contextual command contract

The server derives the command rail from the freshly loaded authoritative
Voyage state. Terminal Voyages and a vacant Captain assignment expose no
commands. Pending verification exposes the approved/reject/override choices;
available published hints expose the next-hint choice; an active Voyage exposes
pause, presentation replay, and explicit published-Passage movement; a paused
Voyage exposes resume; rollback appears only where a prior entered Passage is
known.

`POST /api/captain/voyages/:voyageId/commands/preview` validates the selected
context and returns the current lifecycle, Passage, sequence, selected target,
consequences, reversibility, Player-visible effect, risk level, and reason/
confirmation requirements. `POST /api/captain/voyages/:voyageId/commands`
repeats the server-side availability and target checks, verifies CSRF, and
delegates to `captainSessionAction`.

High- and medium-impact actions require an explicit confirmation. Actions that
already require canonical explanatory evidence also require a bounded Captain
reason. The client never asks a Captain to provide raw command names, opaque
identifiers, or JSON.

## Concurrency, retries, and reconciliation

Every prepared command carries the projection's `currentSequence`. The
canonical action checks that sequence inside its mutation transaction. A
competing successful mutation returns `409 STALE_SEQUENCE`; the console keeps
the authoritative state unchanged locally, refreshes it, and tells the Captain
to review the new condition before continuing.

The command's idempotency key remains stable for a retry of the same selected
action and target. The canonical event/verification duplicate lookup happens
before the sequence conflict check, so a lost response can reconcile to its
original outcome without appending a duplicate event. The browser refreshes
the projection at a bounded visible-tab cadence and after every completed or
rejected action. Phase 3 does not claim a new realtime channel.

## Experience and accessibility

The Captain page has one operational reading order: live state and refresh,
Needs Attention, contextual commands, the safe progression map, Crew state,
then recent safe outcomes. Confirmation text includes target, current revision,
consequence, reversibility, and whether Players may immediately see a result.
The controls use native buttons/selects, semantic headings/lists, focus-safe
dialogs, visible success/error states, responsive one-column reflow, and the
existing effective-200-percent zoom/reduced-motion contracts.

## Explicit non-goals

- No Creator editing, notes, draft disclosure, or hidden-answer access.
- No Player command or expanded Player projection.
- No schema migration or new persisted Helm command/event table.
- No provider/device configuration, recovery automation, preflight, or P4
  operational fallback work.
- No deployment, live-Voyage, external-provider, physical-device, or owner
  acceptance claim.
