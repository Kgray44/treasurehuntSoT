---
title: Project Sounding Line Phase 2 Resource Broker and Lease Model
audience: engineering
status: current
---

# Resource Broker and Lease Model

Broker state is local to `%LOCALAPPDATA%/ForeverTreasureCompanion/SoundingLine/runs`.
Every lease carries resource type/key, mode, revision, run ID, controller token,
heartbeat and expiry. Bundles are all-or-nothing under a short file lock.

Ownership requires an exact marker and token. Expired work with a missing
process identity, PID reuse, or forged marker is quarantined, never killed.
Acquire, adapter start/finish, release and cleanup each produce receipts.
