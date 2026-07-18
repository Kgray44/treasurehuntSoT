# ADR 0003: Vision platform adapters

Status: accepted for Phase B-1

## Context

The shared UI must work in browser, PWA, and desktop environments while future native capture remains outside B-1.

## Decision

Define one `VisionPlatformAdapter` contract and select `MockVisionPlatformAdapter`, `WebCompanionPlatformAdapter`, or `DesktopPlatformAdapter` through a factory. Components depend only on the contract. Desktop bridge calls and future localhost communication stay inside adapters.

## Alternatives considered

- Platform checks inside React components: rejected because capability behavior would scatter.
- A single adapter with optional methods: rejected because unavailable and incompatible states would become ambiguous.

## Consequences

Capability reporting and error behavior are explicit and testable. B-2 can replace an adapter without redesigning UI or story logic.

## Migration implications

Existing helper APIs remain compatible and may later back a Companion adapter.

## Security implications

Native APIs are never imported by shared UI. Capability truth prevents a browser from pretending native capture exists.

## Compatibility implications

All adapters consume the same versioned protocol and return the same governed results.
