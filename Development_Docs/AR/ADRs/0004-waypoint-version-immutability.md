# ADR 0004: Vision Waypoint version immutability

Status: accepted for Phase B-1

## Context

One reusable waypoint may serve many stories. Editing a published version in place would silently change active and historical playthrough behavior.

## Decision

Separate stable `VisionWaypoint` identity from numbered `VisionWaypointVersion` records. Only unpublished draft versions are editable. Publication creates a one-to-one immutable publication record, deterministic package artifact and SHA-256 hash. New work derives a draft with `parentVersionId`. Story bindings pin the exact published version.

## Alternatives considered

- Store the latest configuration on the stable waypoint: rejected because stories would float.
- Copy configuration into every story only: rejected because reuse, usage lookup, and governed package identity would be lost.

## Consequences

Edits require explicit new drafts and story migration. Deprecated versions remain resolvable.

## Migration implications

The schema is additive and does not modify existing Tall Tale publication rows.

## Security implications

Publication and binding require server authorization. Artifact hashes detect modified development packages.

## Compatibility implications

Package schema and compatibility metadata are versioned independently of database migrations.
