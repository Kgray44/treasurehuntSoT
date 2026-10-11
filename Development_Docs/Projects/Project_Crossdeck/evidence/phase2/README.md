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

D0 passed at the recorded development revision. The original D1 receipts predate
the final readiness, reconnect and map-context corrections. The `recovery`
directory additionally preserves D0 on clean `bbd73638`, both successful D1
journeys on clean `43812da1`, and D2 discovery on that same clean revision. Its
manifest records original and archived hashes; JSON fields and screenshot bytes
remain unchanged. Failed aggregate decisions and the failed D1 receipt are
retained alongside successful recovery evidence. D1 is browser emulation. D2 is
UNSUPPORTED because this host has no configured task-owned ADB/emulator/Android
Chrome path; it is not substituted by D1.

These files preserve development history and do not constitute final-head,
protected-main, owner, physical-device or field acceptance. Crossdeck has received
the coordinator's single shared heavy-testing slot. Final-head qualification is
reported by the source-bound canonical local decision at
`artifacts/sounding-line/ordinary-decision.json`, only when its candidate matches
HEAD; these historical files cannot promote that result. See the
[implementation record](../../Phase_2_Implementation_Record.md) for scope,
requirement mapping, integration seams and remaining gates.
