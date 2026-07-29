---
title: Project Sounding Line Phase 2 Runtime Root and Process Ownership
audience: engineering
status: current
---

# Runtime Root and Process Ownership

A run root is outside every worktree and has a random controller token plus
`run-marker.json`. Filesystem roots, repositories, and unmarked paths are
refused. Receipts, logs, clones, browser state and traces stay beneath it.

Process ownership is conjunctive: PID, start time, boot identity, controller
identity and command fingerprint must match. The validation harness additionally
records launcher/listener ancestry and cleans only those identities.
