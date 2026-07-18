# ADR 0007: Deterministic mock verification

Status: accepted for Phase B-1

## Context

B-1 authorizes mocks only for capture and visual inference. Persistence, adapter invocation, protocol validation, lifecycle, stale checks, and event delivery must be real.

## Decision

Implement named deterministic scenarios with fixed result/guidance mappings and a stable SHA-256 evidence digest. The adapter sends real protocol envelopes, the server persists attempts/transitions, and accepted results enter the existing progression engine. Duplicate and stale scenarios exercise the real rejection paths.

## Alternatives considered

- Random confidence/results: rejected because tests and demonstrations would be irreproducible.
- In-memory fake store: prohibited because it bypasses persistence and audit truth.

## Consequences

Every scenario is repeatable. The expected mock outcome is labeled separately from internal failures.

## Migration implications

The mock adapter can be disabled or removed after later real adapters pass the same contract suite.

## Security implications

Mock execution is server-flagged and production-disabled by default. It grants no generic progression command.

## Compatibility implications

Results use the same protocol, attempt state, and story event contracts as future inference.
