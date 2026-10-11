---
title: Crossdeck Phase 2 preserved development evidence
audience: product-engineering
status: development-evidence
canonical_for: crossdeck-phase2-development-evidence
last_reviewed: 2026-10-11
---

# Preserved development evidence

The `development` directory contains shared Device Lab receipts and
synthetic browser screenshots, with original and preserved hashes in `preservation-manifest.json`.
Each receipt retains its original source SHA, tree, dirty flag and fingerprint.
Receipt fields are unchanged; archive JSON whitespace is normalized for the
repository formatter. Screenshot bytes are unchanged.
Artifact paths in those receipts refer to the original local test run; preserved
screenshots retain their bytes under descriptive archive filenames.

D0 passed at the recorded development revision. D1 passed before the final
readiness, reconnect and map-context corrections and must be rerun against the
final candidate. D1 is browser emulation. D2 is UNSUPPORTED because this host has
no configured ADB/emulator/Android Chrome path; it is not substituted by D1.

These files preserve development history and do not constitute final-head,
protected-main, owner, physical-device or field acceptance. Final qualification
is awaiting the coordinator's shared heavy-testing slot. See the
[implementation record](../../Phase_2_Implementation_Record.md) for scope,
requirement mapping, integration seams and remaining gates.
