---
title: Project Bridgewatch v2.0 Phase 1 Validation Record
audience: engineering
status: local-qualified-pending-protected-integration
canonical_for: project-bridgewatch-v2-phase-1-validation
last_reviewed: 2026-08-18
---

# Phase 1 validation record

| Check | Result |
| --- | --- |
| Bridgewatch TypeScript build | passed: `tsc -p bridgewatch/tsconfig.json` |
| Focused source/server/UI tests | passed: 22 tests / 5 files |
| Managed lifecycle | passed: task-owned `127.0.0.1:48519` reports `/healthz` 200 |
| Direct API audit | passed: `/api/sources` reports identity, dimensions, and explicit coverage/failure states |
| Browser inspection | passed: desktop and 390 px Sources & Data Quality views have no horizontal overflow |

The GitHub collector and configured runtime identity resolve to
`Kgray44/treasurehuntSoT`. Before repair, Project Registry profiles displayed
`forever-treasure/forever-treasure-companion`. Registry rebinding before
discovery, storage, API projection, and UI rendering removes that mismatch.

The local repository source successfully collected 993 document/ref inputs and
29 reconciled projects. GitHub was degraded under anonymous quota exhaustion
while retaining a bounded snapshot; it is displayed as a source failure.
Sounding Line has three retained legacy markers but no current identity/node
evidence and is classified `HISTORICAL_EVIDENCE_UNAVAILABLE`. Optional reporter
telemetry is not configured. The authorization-gated Homeport `/bridgewatch`
route is not used as proof of access, deployment, or owner acceptance.

This is local qualification only. Protected merge/tree parity and a Sounding
Line `RELEASE_GO` decision are not claimed.
