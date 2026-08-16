---
title: Sounding Line v1.4.1 proof-input authority correction record
audience: engineering
status: implementation
canonical_for: sounding-line-v141-proof-input-authority-correction
last_reviewed: 2026-08-14
---

# Sounding Line v1.4.1 proof-input authority correction

## Defect and bounded repair

The verification-maintenance workflow created its changed-path proof input in
the repository checkout. On Windows runners, repository-wide static formatting
therefore inspected the transient PowerShell-written JSON and rejected it.

This owner-ratified correction moves workflow-only proof inputs and sealed
qualification artifacts to a unique runner-owned temporary directory. The
trusted classifier consumes the same sorted changed-path set from that path;
no browser, request, or user input controls the location. Cleanup runs
deterministically after artifact upload.

The workflow derives that directory from `RUNNER_TEMP` inside runner-executed
PowerShell steps, because GitHub does not expose the `runner` context to a
job-level environment expression. The trusted binding step publishes the
already-derived path only as a same-job step output for artifact upload.

## Authority boundary

The repaired workflow remains an authority-change path in
`testing/verification-maintenance-policy.json`. The policy, classifier,
candidate/base/tree binding, and `MAINTENANCE_GO` versus `RELEASE_GO`
separation are unchanged.

Owner authority is required for this correction because the maintenance lane
correctly refuses modifications to its own authority. Once this bounded repair
is protected on `main`, a separate eligible test-only maintenance candidate
must qualify and land through the ordinary verification-maintenance path with
no owner exception.
