# ADR 0014: Version-owned Studio authoring aggregate and deterministic BuildInput

Status: accepted for Phase B-3

## Context

Phase B-3 adds a resumable creator workflow spanning prose, B-2 recordings, accepted-pose regions, boundaries, hard negatives, image-space regions, tests, health checks, and build preparation. The base schema already models the large evidence records, while `VisionWaypointVersion.draftConfiguration` owns model-agnostic draft policy. Browser and desktop must expose the same authoring truth, concurrent tabs must not silently overwrite one another, and Phase B-3 must not imply that a Phase B-4 recognition model exists.

## Decision

Treat each editable `VisionWaypointVersion` as one authoring aggregate:

- strict, step-specific wizard answers live in the version's draft configuration;
- recordings, pose regions, image regions, hard-negative sets, build jobs, artifacts, and test cases remain normalized child records;
- the version stores authoring mode, current wizard step, and a monotonically increasing authoring revision;
- every authoring mutation supplies the expected revision and increments it atomically;
- published versions reject every authoring mutation;
- data health is computed from persisted aggregate state and returns actionable blockers and warnings;
- BuildInput is canonicalized by schema version and stable ordering, hashed, and persisted with its preparation job;
- the development build fixture is separately feature-gated and records that it produced input only, with no model, inference, confidence, or certification.

The UI may keep unsaved form state locally for interaction, but it never treats that state as authoritative. Resume always reloads the server aggregate.

## Alternatives considered

- One JSON document for all authoring data: rejected because evidence references, deletion safety, integrity state, test locks, and build lineage need relational constraints and queryable ownership.
- A new B-3-only frontend or desktop renderer: rejected because it would violate the shared product and parity requirements.
- Last-write-wins saves: rejected because they can silently destroy creator work.
- Pretending a fixture job is a model build: rejected because Phase B-4 owns model creation and evaluation.

## Consequences

The authoring service must compose normalized rows into one response and transactionally enforce revision checks. Some recording edits are non-destructive metadata or logical segments over a managed B-2 artifact; the UI must describe them accurately. A build-preparation success means only that persisted input is complete and schema-valid.

## Security and privacy implications

Every read and write is scoped to the waypoint owner and a server-side Vision permission. Raw creator media remains under the B-2 managed local storage boundary. BuildInput contains hashes, roles, labels, and governed metadata, not media bytes or arbitrary local paths.

## Compatibility implications

The migration is additive over B-2. Existing drafts receive guided mode, step one, and revision one. The service upgrades absent B-3 authoring data to strict defaults when read; existing published packages and exact story bindings are unchanged.
