# ADR 0015: Local classical verification engine and immutable data packages

Status: accepted for Phase B-4

## Context

Phase B-4 must turn B-3 BuildInput into a real verification package and run multi-frame verification without sending player pixels or creator recordings to the web server. The repository has no approved learned model bundle or native computer-vision dependency. Any first implementation must still derive evidence from real pixels, preserve mandatory independent gates, and fail safely when general 3D or semantic recognition is unavailable.

## Decision

Run the build and runtime engine inside the existing Electron Companion process. The first provider is a project-authored CPU classical pipeline:

- signed gray-gradient spatial-pyramid descriptors for global target and negative retrieval;
- gradient-patch keypoints with mutual ratio matching;
- deterministic RANSAC homography and spatial-coverage measurement;
- a connected planar reference graph and reference-relative pose estimate;
- per-waypoint thresholds calibrated against target, hard-negative, validation, and locked-test partitions;
- an independent full-frame disagreement resolver for borderline retrieval;
- all governing gates recorded separately, with no weighted score able to bypass a failed gate.

Creator capture retains bounded, selected, grayscale authoring frames beside the creator-owned WebM. Player scan frames remain memory-only and are zeroized after the runtime consumes them. Runtime packages are canonical JSON data envelopes with per-artifact hashes and a full digest. Packages contain no executable code and require no raw creator recording.

General metric 3D reconstruction, learned semantic matching, and item-state detection are explicitly unavailable. The package records those limitations. `ITEM_PICKUP` cannot verify without its governed detector, and uncertain evidence rejects.

## Alternatives considered

- Upload recordings to a hosted model service: rejected because B-4 is local-first and no raw-media authority exists.
- Add OpenCV, COLMAP, ONNX Runtime, CUDA, or DirectML immediately: rejected for this baseline because no dependency, binary, model, license, packaging, or provider qualification had been approved.
- Continue deterministic mock confidence: rejected because it does not consume pixels and cannot satisfy B-4.
- Collapse gates into one confidence number: rejected by the governing specification.

## Consequences

The CPU path is functional, deterministic, replaceable, and testable, but has narrower viewpoint and semantic tolerance than a qualified learned/3D stack. Real Sea of Thieves pilot evidence is required before this phase can pass its exit gate. Package schema 1 is data-only and signing-ready through a reserved signature field; signing remains B-6 work.

## Security and privacy

No game injection, memory inspection, game-file reading, input automation, overlay injection, packet inspection, or network-traffic inspection is introduced. Companion resolves only managed artifact IDs. Runtime results contain hashes, metrics, and gate evidence, never raw frames. Automatic story progression remains false.
