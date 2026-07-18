# ADR 0009: Verification event idempotency and stale protection

Status: accepted for Phase B-1

## Context

Retries, reconnects, delayed results, and duplicate delivery must not advance a story twice or complete a stale stage.

## Decision

Give every attempt a stable unique idempotency key derived from session, block, waypoint version, attempt, and event type. Immediately before delivery, recheck the active session, block, pinned story version, waypoint version, request state, and cancellation state. Route accepted results through existing unique `TaleVerificationEvent` and `TaleSessionEvent` keys. Persist duplicate/stale rejection metadata on the attempt.

## Alternatives considered

- Client-side deduplication: rejected because clients can retry, reconnect, or be duplicated.
- Marking the attempt complete before story delivery: rejected because partial failure would be ambiguous.

## Consequences

Duplicate replay returns the prior outcome, creates no second progression history, and remains observable. Stale results close without delivery.

## Migration implications

Existing story idempotency remains unchanged; Vision attempts add another durable correlation layer.

## Security implications

Replayed or cross-stage results cannot unlock content.

## Compatibility implications

Future adapters must preserve attempt and message identity across retries.
