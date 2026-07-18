# ADR 0008: Typed feature flags

Status: accepted for Phase B-1

## Context

Later Phase B capabilities must remain hidden and unauthorized while B-1 mock surfaces are available in development and test.

## Decision

Define all Vision flags in one typed registry with documented environment defaults. Server modules enforce feature availability and permissions. A serializable public subset controls presentation and adapter selection but cannot grant server access.

## Alternatives considered

- Local-storage flags: rejected because they are user-modifiable and unaudited.
- Scattered environment checks: rejected because defaults and diagnostics would drift.

## Consequences

Flags appear in diagnostics and have enabled/disabled tests. Production defaults keep unfinished capture, build, shadow, automatic, and live AR features off.

## Migration implications

Flags can later move to a persistent deployment service while preserving names and types.

## Security implications

Changing client state cannot bypass server authorization or production mock restrictions.

## Compatibility implications

Unknown environment values fail to documented safe defaults.
