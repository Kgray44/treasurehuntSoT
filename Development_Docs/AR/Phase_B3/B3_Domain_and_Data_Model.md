# Phase B-3 Domain and Data Model

## Aggregate identity and lifecycle

`VisionWaypoint` is the reusable identity. `VisionWaypointVersion` is the immutable version boundary and B-3 authoring aggregate root.

```text
DRAFT
  -> authoring mutations (revision +1)
  -> deterministic BuildInput preparation
  -> READY_TO_BUILD (sealed against authoring edits)

DRAFT -> PUBLISHED (legacy deterministic development package path)
PUBLISHED -> DEPRECATED
PUBLISHED -> create new DRAFT (parentVersionId preserves lineage)
```

`PUBLISHED` and `READY_TO_BUILD` reject authoring mutations. Existing Tall Tale bindings stay pinned to their exact published version.

## Added columns

### VisionWaypointVersion

- `authoringRevision Int default 1`
- `authoringMode String default GUIDED`
- `currentWizardStep Int default 1`

### VisionRecordingAsset

- `creatorNotes`
- `role`
- `isUsable`
- `segmentStartMs`, `segmentEndMs`, `sourceAssetId`
- `integrityState`
- `cloudState`

Roles are `UNASSIGNED`, `TARGET_REFERENCE`, `ACCEPTED_AREA`, `BOUNDARY`, `HARD_NEGATIVE_NEARBY`, `HARD_NEGATIVE_DISTANT`, `INVALID_POSE`, `VALIDATION`, and `LOCKED_TEST`. Locked-test separation is also recorded in `datasetPartition` and the test row.

### VisionBuildJob

- `inputSchemaVersion`
- `buildInput`
- `inputHash`

### VisionWaypointTestRun

- `name`
- `instructions`
- `environment`
- `assetRole`
- `lockedAt`

## Existing normalized children used by B-3

- `VisionCaptureSession`: B-2 session/protocol/quality/interruption/consent truth;
- `VisionRecordingAsset`: retained media manifest and curation metadata;
- `VisionPoseRegion`: accepted/boundary/excluded creator-relative rules;
- `VisionRegion`: normalized image-space target/stable/ignore/transient geometry;
- `VisionHardNegativeSet`: named confuser classification, reason, and evidence IDs;
- `VisionWaypointTestRun`: positive/negative/boundary/environment test cases and lock state;
- `VisionBuildJob` and `VisionBuildArtifact`: persisted BuildInput lineage;
- `PlatformAuditEvent`: mutation and build-preparation audit trail.

## BuildInput schema version 1

The canonical shape is:

```json
{
  "schemaVersion": 1,
  "inputType": "VISION_WAYPOINT_BUILD_INPUT",
  "waypoint": {
    "id": "...",
    "versionId": "...",
    "versionNumber": 1,
    "type": "EXACT_LANDMARK",
    "verificationProfile": "STORY_CRITICAL"
  },
  "authoring": {
    "schemaVersion": 1,
    "completedSteps": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    "steps": {}
  },
  "assets": [],
  "acceptedPoseRegions": [],
  "visualRegions": [],
  "hardNegatives": [],
  "validationTests": [],
  "lockedTests": [],
  "boundary": {
    "implementation": "INPUT_PREPARATION_ONLY",
    "modelProduced": false,
    "confidenceProduced": false,
    "certificationProduced": false
  }
}
```

Objects are key-sorted recursively. Arrays derived from database records are sorted by stable ID. The SHA-256 hash covers the exact UTF-8 serialization. Raw media bytes and arbitrary local filesystem paths are excluded.

## Referential deletion policy

A recording can be soft-deleted only when:

- no `VisionRegion` references it;
- no locked test environment names it;
- no BuildInput job exists for its waypoint version.

The Studio disables unsafe deletion and the server independently enforces it. Deletion changes `deletionStatus` and `deletedAt`, increments the aggregate revision, and writes an audit event. It never cascades into silent evidence loss.

## Migration and rollback notes

The SQLite and MySQL migrations add nullable/defaulted columns only. B-2 rows remain readable. SQLite rollback requires a copy-and-rebuild migration and must not be attempted before exporting creator drafts and BuildInput snapshots. Feature disable/previous-build deployment is preferred to destructive schema rollback.
