# Phase B-4 Models, Libraries, and Licenses

## Active implementation

No external model weights, CV binary, dataset, or newly licensed runtime library is embedded in B-4.

The active algorithms in `apps/companion/vision-*.cjs` are project-authored JavaScript:

- gray-gradient spatial-pyramid global descriptor;
- gradient-patch local descriptor and mutual ratio matcher;
- deterministic linear homography estimation and RANSAC;
- convex-hull/grid spatial coverage;
- planar reference graph and relative pose approximation;
- per-waypoint calibration, hard-negative separation, temporal consensus, and disagreement resolution.

They use Node built-ins (`crypto`, `fs`, `zlib`, `os`, `events`) and existing repository dependencies. The package label `classical-vision-cpu-1` identifies algorithms and parameters; it is not a third-party learned model.

## Provider inventory

- `CPU_CLASSICAL`: available and active; global descriptor, local features, homography, and relative pose.
- `DIRECTML_DETECTED`: hardware detection only; inactive; no backend or claims of acceleration.
- `CUDA_DETECTED`: hardware detection only; inactive; no backend or claims of acceleration.

The provider router records every attempted provider. Fallback requires explicit permission. Hardware detection is never reported as successful inference.

## Future approval gate

Before adding OpenCV, ONNX Runtime, learned weights, COLMAP, CUDA, DirectML, or another provider, record version, source, license, model card, training-data provenance when applicable, package size, supported hardware, fallback behavior, privacy, determinism, and field-validation evidence in a new ADR and inventory revision.
