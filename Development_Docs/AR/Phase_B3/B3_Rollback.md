# Phase B-3 Rollback and Draft Preservation

## Preferred rollback

1. Disable deterministic input preparation by removing or setting `FEATURE_VISION_BUILD_ENGINE=false`.
2. If authoring must be hidden, set `FEATURE_VISION_WAYPOINTS=false` / `NEXT_PUBLIC_VISION_WAYPOINTS=false` according to the deployment environment.
3. Stop the app normally.
4. Export/back up the database and Companion managed creator-recording directory.
5. Deploy the previous stable B-2 commit `eec2c73146a63d6f061254209fef59ac5d4691a5`.

The B-3 migration is additive, so B-2 binaries ignore the added columns. Existing B-1 publications, story bindings, and B-2 capture records remain present.

## Preserve creator drafts

Before any schema rollback, preserve:

- `VisionWaypoint`, `VisionWaypointVersion.draftConfiguration`, authoring revision/mode/step;
- capture sessions/assets and manifests;
- pose/visual regions and hard-negative sets;
- tests and lock timestamps;
- build jobs, input hashes, and exact `buildInput` text;
- associated audit events;
- Companion-managed local media files.

Verify hashes after export. Do not delete local recordings merely because the server feature is disabled.

## Schema rollback

Do not run the B-3 migration SQL backward in place. SQLite does not safely drop these columns without table reconstruction, and MySQL column removal would destroy authoring metadata. If schema rollback is unavoidable:

1. take and verify a complete backup;
2. export B-3 authoring aggregates and BuildInput snapshots;
3. create a reviewed down-migration in a disposable copy;
4. prove B-1 publications, exact bindings, and B-2 manifests still validate;
5. schedule the production operation with an explicit recovery window.

Feature disable plus previous-build deployment is the safe normal rollback.
