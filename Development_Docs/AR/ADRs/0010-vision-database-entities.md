# ADR 0010: Vision database entity design

Status: accepted for Phase B-1

## Context

The governing model requires reusable identities, immutable versions, future authoring/build foundations, story bindings, attempts, evidence, devices, and pairing without model-specific coupling.

## Decision

Add normalized Prisma entities for waypoint identity/version/publication, draft capture/recording/region/pose/negative/build/artifact/certification/test foundations, story bindings, attempts and ordered transitions, evidence bundles, custom verification profiles, Companion devices, and expiring pairing sessions. JSON columns store only schema-versioned configuration or extensible metadata; identity and referential rules remain relational.

## Alternatives considered

- One JSON waypoint table: rejected because relations, immutability, usage, and lifecycle constraints would be weak.
- Store artifacts in database blobs: rejected; records hold hashes, sizes, and storage references.

## Consequences

The schema is larger in B-1 but avoids breaking redesign in B-2 through B-4. Services operationalize only the B-1 subset.

## Migration implications

SQLite and MySQL receive matching additive migrations, indexes, foreign keys, and uniqueness constraints. Existing records are untouched. Rollback is application rollback plus matched database backup restore because repository policy uses forward-only production SQL.

## Security implications

Pairing stores hashes only; raw frame payloads are not stored by default; ownership and collaboration checks remain server-side.

## Compatibility implications

Model/library versions live in build/certification metadata, not story blocks or stable waypoint records.
