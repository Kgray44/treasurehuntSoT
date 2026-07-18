# ADR 0005: Zod protocol serialization and validation

Status: accepted for Phase B-1

## Context

Vision messages will cross web, desktop, Companion, worker, and server boundaries. TypeScript-only interfaces provide no runtime protection.

## Decision

Use strict Zod schemas as the canonical protocol implementation. A versioned common envelope, discriminated message types, capabilities, governed errors, package manifests, and examples are shared by all B-1 runtimes. JSON remains the wire format.

## Alternatives considered

- Informal interfaces: rejected because invalid runtime messages would pass unchecked.
- A second schema technology: rejected because Zod is already a core repository dependency and route convention.

## Consequences

Schemas provide inferred TypeScript types and runtime parsing. Contract snapshots guard drift.

## Migration implications

Protocol major/minor compatibility is separate from application/database versioning.

## Security implications

Unknown types, versions, enum values, and unrecognized fields fail closed at boundaries.

## Compatibility implications

Examples are plain JSON and can be validated by future non-TypeScript implementations against generated JSON Schema/OpenAPI documentation.
