# Phase B-3 Studio Authoring Architecture

Status: implemented and automated validation passed; external demonstration and usability gates remain blocked
Phase boundary: creator authoring and deterministic BuildInput only

## Shared product boundary

B-3 extends the existing Next.js Studio. Browser, PWA, and Electron load the same routes and React components:

- `/studio/vision-waypoints` — reusable library;
- `/studio/vision-waypoints/[waypointId]` — version history and authoring wizard;
- `/vision-companion` — shared B-2 connection, pairing, privacy, and diagnostics surface.

There is no B-3-only desktop renderer. `selectCapturePlatformAdapter()` chooses the B-2 integrated desktop or paired-browser transport. Both transports call protocol 2.0 commands on the same Companion coordinator and capture core.

```text
VisionWaypointLibrary
  -> /api/vision-waypoints

VisionWaypointEditor (shared web/PWA/Electron UI)
  -> /api/vision-waypoint-versions/:id/authoring
  -> authoring aggregate service
       -> VisionWaypointVersion draft configuration + revision
       -> capture/assets/pose/regions/negatives/tests/build jobs
       -> PlatformAuditEvent
  -> CapturePlatformAdapter
       -> DesktopCapturePlatformAdapter -> restricted Electron IPC --+
       -> WebCapturePlatformAdapter -> paired loopback WebSocket -----+-> B-2 CompanionCoordinator/CaptureCore
  -> /api/vision-waypoint-versions/:id/prepare-build
       -> deterministic canonical BuildInput snapshot
       -> no B-4 model, inference, confidence, or certification
```

## Authoring aggregate

The editable `VisionWaypointVersion` is the aggregate root. It owns:

- `authoringRevision`: monotonically increasing optimistic-concurrency token;
- `authoringMode`: `GUIDED`, `DETAILED`, or `ENGINEERING`;
- `currentWizardStep`: persisted step 1 through 12;
- strict step answers inside the versioned draft configuration;
- normalized child records for recordings, pose regions, visual regions, hard negatives, tests, and build preparation.

Every authoring mutation supplies `expectedRevision`. The service checks ownership, draft lifecycle, and revision in one transaction, applies normalized changes, increments the revision atomically, and creates an audit event. A stale revision returns `AUTHORING_CONFLICT` and the current revision. Published and ready-to-build versions reject edits.

Form edits use a one-second debounced save. Navigation is disabled while a save is pending, so leaving a step cannot silently discard queued changes. Explicit **Save and continue** validates and marks the step complete. The displayed `Saved`, `Unsaved changes`, and `Saving…` states reflect real network/persistence state.

## Twelve-step state

The strict `authoringStateSchema` stores the following step documents:

1. purpose and success definition;
2. player task and narrative intent;
3. Companion path and privacy acknowledgment;
4. target coverage plan and representative asset;
5. accepted-area instructions and provisional-accuracy acknowledgment;
6. boundary instructions and reasons;
7. confuser analysis and Story-Critical acknowledgment;
8. durable/ignored visual guidance;
9. data-health review timestamp and acknowledged warning codes;
10. future execution target and raw-media consent state;
11. test-plan and locked-test notes;
12. consent, no-model, and locked-test confirmations.

All seven initial waypoint types use the same aggregate and wizard. Type-specific health rules add requirements without separate editors.

## Capture integration

`StudioCapturePanel` calls only B-2 adapter methods:

- capabilities/status and target enumeration;
- explicit individual-window selection;
- `capture.creator.start`, pause, resume, stop, and cancel;
- status/progress events;
- local preview/export and deletion.

On stop, the returned B-2 manifest is posted to `/api/vision-capture-sessions`. Studio does not create a success record until the manifest is validated and persisted. A save failure tells the creator the local recording was retained and the Studio manifest was not saved.

Recordings expose real manifest quality, content hash, integrity, local/cloud state, category, notes, usability, and non-destructive time ranges. A logical split creates governed time segments over the same local media and explicitly records `mediaNotReencoded: true`; it does not pretend a new media file was generated.

Deletion is blocked when an asset is used by a visual region, locked test, or BuildInput job. The server repeats the check even if the UI is bypassed.

## Accepted area and regions

Accepted, boundary, and excluded areas use `VisionPoseRegion` records in `CREATOR_PROVISIONAL_2D`. The UI labels creator units as provisional and never claims surveyed game-world coordinates or final pose estimation.

Image regions use normalized 0-to-1 coordinates. Rectangle, polygon, and brush geometries are strictly validated and persisted. The editor includes eraser, undo, redo, reset, copy, overlay visibility/opacity, a clearly non-AI layout suggestion, and an always-visible coordinate-list alternative for keyboard/non-pointer editing.

## Data health

Data health is computed from persisted aggregate state. It never reads temporary canvas/form values as evidence. Blockers include incomplete wizard steps, missing target evidence, pose/boundary gaps, Story-Critical nearby or distant hard negatives, missing target regions, missing positive/negative tests, missing locked tests, failed integrity, frozen capture, and missing truth acknowledgments. Every item includes a recovery step.

The percentage is authoring completeness/coverage guidance, not a recognition reliability or confidence score.

## BuildInput boundary

`prepareBuildInput()` is available only outside production and when `FEATURE_VISION_BUILD_ENGINE=true`. It:

1. reloads the owned aggregate;
2. requires the current authoring revision and zero data-health blockers;
3. sorts all arrays and object keys deterministically;
4. serializes schema version 1;
5. hashes the exact serialized bytes with SHA-256;
6. persists the input in `VisionBuildJob.buildInput` and a `BUILD_INPUT` artifact row;
7. marks the version `READY_TO_BUILD`.

The job metadata permanently records `modelProduced: false`, `confidenceProduced: false`, and `certificationProduced: false`. Phase B-4 may consume this contract; B-3 does not select or embed a model.

## Failure and recovery

| Code                          | Meaning                                                         | Recovery                                                        |
| ----------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `AUTHORING_CONFLICT`          | Another save advanced the draft revision                        | Reload, review the current draft, and reapply the intended edit |
| `PUBLISHED_VERSION_IMMUTABLE` | The selected version is sealed                                  | Create a new draft from the published version                   |
| `CAPTURE_ARTIFACT_IN_USE`     | A region, locked test, or build snapshot references a recording | Remove/replace the dependency before deletion                   |
| `INVALID_AUTHORING_ASSET`     | Selected evidence is deleted or unusable                        | Choose a current usable recording                               |
| `LOCKED_TEST_IMMUTABLE`       | Locked test evidence was targeted for edit/delete               | Create a new validation case; preserve the locked test          |
| `DATA_HEALTH_BLOCKED`         | Build preparation still has blockers                            | Follow the returned step-specific recovery items                |
| `BUILD_FIXTURE_DISABLED`      | The development-only input fixture is off                       | Enable only in an authorized development environment            |
| `AUTHORING_PAYLOAD_TOO_LARGE` | The request exceeds 512 KiB                                     | Reduce coordinate/evidence payload size                         |

Companion transport errors retain the governed B-2 codes and add connection, target-selection, or retry guidance in the Studio.

## Compatibility

Migration `20260718140000_vision_studio_authoring_b3` is additive. Existing B-1/B-2 versions receive revision 1, Guided mode, and step 1. Existing publications, package hashes, exact story bindings, capture manifests, and runtime behavior are unchanged. Missing authoring state is upgraded to schema-valid defaults on read.
