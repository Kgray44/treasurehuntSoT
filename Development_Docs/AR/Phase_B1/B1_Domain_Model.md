# Phase B-1 Domain Model

## Stable authoring records

`VisionWaypoint` is the stable identity: owner, name, description, model-agnostic type, tags, sharing scope, archive timestamp, and audit timestamps. Supported types are area arrival, exact landmark, viewpoint, object inspection, item pickup, sequence, and advanced. Sharing values already include private, crew, Tall Tale, community, and official without enabling later publication channels.

`VisionWaypointVersion` is an explicit numbered version with parent lineage, lifecycle state, verification profile, versioned draft configuration, package schema, compatibility metadata, creator/publisher, and lifecycle timestamps. A published version cannot be edited. Later changes require a new draft; deprecation preserves existing story bindings.

`VisionWaypointPublication` seals the version with a SHA-256 package hash, schema version, publisher, compatibility range, and status. B-1 artifacts use the `development-package://sha256/...` reference and never claim to contain a real model.

`StoryWaypointBinding` pins one story block to one immutable version. It carries runtime mode, scan interaction, success event, retry/failure copy, Captain fallback policy, and offline behavior. B-1 permits only `DEVELOPMENT_MOCK`.

## Attempts and supporting foundation

`VerificationAttempt` persists story/stage/player/session/request/version identity, platform and adapter, scenario, protocol/message/idempotency identifiers, result/guidance/evidence digest, event-delivery state, Captain action, stale/duplicate guardrail outcomes, and timestamps. `VerificationAttemptTransition` is an ordered append-only state history.

The state graph is:

```text
IDLE -> ARMED -> CAPTURING -> CURATING_FRAMES -> RETRIEVING -> MATCHING
  -> LOCALIZING -> EVALUATING_SEQUENCE -> EVALUATING_SPECIAL_RULES
  -> VERIFIED | INSUFFICIENT | NOT_AT_TARGET | AMBIGUOUS | ERROR | CANCELLED
VERIFIED -> EVENT_DELIVERED -> RESULT_DISPLAYED -> CLOSED
```

Invalid transitions throw `INVALID_ATTEMPT_TRANSITION`. Current-stage validation occurs again at delivery, not only when the attempt is created.

Additional persistent entities establish future-compatible boundaries without implementing capture or inference: capture sessions, recording assets, regions, pose regions, hard-negative sets, build jobs/artifacts, certification runs, waypoint test runs, verification profiles, evidence bundles with retention/deletion fields, companion devices, and expiring pairing sessions whose secrets are hash-only.

## B-1 fixture

`prisma/seed.ts` idempotently ensures `B-1 Painted Lantern Waypoint` and the published tale `b1-vision-waypoint-demo`. Running `npx tsx prisma/seed.ts --ensure` never duplicates them and preserves accepted campaign progress.
