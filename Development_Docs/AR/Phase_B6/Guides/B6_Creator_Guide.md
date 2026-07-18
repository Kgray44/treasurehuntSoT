# Creator guide: Vision Waypoints

> Release status: experimental, NO-GO. Use synthetic/development or governed pilot work only. Do not promise automatic public verification.

## Start and orient

Use the development launcher or an authorized development installer. Sign in to Studio and open **Vision Waypoints**. **Vision help** opens the skippable, revisitable orientation. Companion health must be ready before recording.

Vision types currently include Exact Landmark, Area Arrival, and Viewpoint. Use Exact Landmark for a distinctive object from a constrained pose, Area Arrival for a broader accepted region, and Viewpoint when orientation/framing matters. All remain experimental until real certification exists.

## Authoring workflow

1. Create a waypoint and choose its type and risk profile. Story-Critical requires stricter hard-negative coverage.
2. Select the intended Sea of Thieves application window in Companion; do not use screen-wide or unrelated-window capture.
3. Record varied target coverage. Creator recordings are retained authoring assets and display their storage/dependency state.
4. Define accepted positions, boundaries, orientation, distance, and visibility. Record near and far boundary cases.
5. Record similar wrong places as hard negatives. They are mandatory protection, not optional polish.
6. Mark stable regions that carry reliable scene identity and ignored regions that move, flicker, or reveal private/unreliable content.
7. Resolve data-health warnings. A reliability grade summarizes the current evidence; it is not artistic quality or a guarantee.
8. Prepare the immutable BuildInput. Build/calibration inputs stay separate from locked tests.
9. Build, inspect mandatory gate results, and run positive, negative, boundary, and hard-negative tests.
10. Use shadow mode first. Publication seals a version; improvements require a new version.
11. Attach the exact published version to a Tall Tale. Never silently replace a pinned runtime package.

## Improvement queue

Captain truth labels create metadata-only candidates. In **Release readiness**, review the reason, truth label, proposed partition, version, and non-retention status. Accepting means “accepted for independent corpus review”; it does not modify training, calibration, locked tests, thresholds, or a published package. Reject or defer with an audited reason.

## Troubleshooting

- Too few views or coverage warning: record materially different legitimate approaches.
- Hard negative too similar: constrain pose/region, add stable local detail, or keep Captain confirmation.
- Reconstruction failure: improve overlap, texture, sharpness, and camera motion; never lower mandatory gates just to pass.
- Package incompatible: create a new build for the supported schema/engine; do not edit a published package.
- Repeated false rejection: label the attempt truthfully and review it as a candidate; do not tune on a locked test.
