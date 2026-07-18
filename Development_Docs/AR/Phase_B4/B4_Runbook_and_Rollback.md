# Phase B-4 Runbook and Rollback

## Pilot enablement

Keep the engine off by default. For an authorized local pilot set:

```text
FEATURE_VISION_BUILD_ENGINE=true
FEATURE_VISION_RUNTIME_ENGINE=true
FEATURE_VISION_RECONSTRUCTION=true
FEATURE_VISION_SECONDARY_MATCHER=true
FEATURE_SHADOW_VERIFICATION=true
FEATURE_AUTOMATIC_VISION_PROGRESSION=false
```

Run desktop Companion, select the Sea of Thieves window, finish B-3 authoring with independent target, validation, locked, and hard-negative recordings, then use **Build verification package locally**. Progress and failure codes appear in Studio. A completed package can run a five-second shadow scan; the result persists without a story event.

Older B-2/B-3 recordings lack B-4 derived frame sets. The build returns an artifact-missing remediation and requires a new recording; it does not fabricate frames or accept an arbitrary path.

## Diagnostics

Inspect Companion structured logs, `VisionBuildJob.report`, `VisionCertificationRun`, and `VisionShadowAttempt`. Provider inventory distinguishes active CPU from detected-only GPU providers. A zero observed false-accept count is reported with the approximate rule-of-three bound and is never described as proof.

## Rollback

1. Set build, runtime, reconstruction, secondary matcher, and shadow flags false. Leave automatic progression false.
2. Stop Companion after active capture/build cancellation completes.
3. Deploy the B-3 source commit or later safe release.
4. Keep additive schema columns/tables until package, report, certification, shadow truth labels, and rebuild lineage have been exported.
5. Do not delete creator recordings or packages as part of code rollback. They are managed user artifacts.

Rolling back application code does not make an already produced package automatic. B-4 never grants that authorization.
