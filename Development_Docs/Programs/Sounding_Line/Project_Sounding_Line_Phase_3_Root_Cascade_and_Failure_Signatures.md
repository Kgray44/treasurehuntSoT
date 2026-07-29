---
title: Project Sounding Line Phase 3 Root Cascade and Failure Signatures
audience: engineering
status: current
---

# Root, cascade, and signature contract

Root classification uses explicit plan/setup/fixture/database/service/browser/evidence/cleanup dependencies, temporal order, shared error fingerprints, process exits, and resource failures. A single failed database setup may produce one `FAILED_ROOT` plus many `CASCADE_BLOCKED` descendants; a product defect with independent assertions remains multiple roots when no causal dependency exists. Terminal reconciliation is exactly `planned = passed + passedAfterRetry + failedRoots + cascadeBlocked + skippedPolicy + cancelled + notRun`.

Signatures use failure class, suite/test ID, normalized stack frames, error code, assertion location, dependency/resource/process/browser/route/contract/environment identity. They exclude timestamps, random IDs, temporary paths, ports, account IDs, secrets, private content, and unstable line noise. Levels are `EXACT_OCCURRENCE`, `SAME_ROOT_HIGH_CONFIDENCE`, `SAME_FAMILY`, `POSSIBLY_RELATED`, and `UNRELATED`; collision review prevents phrase-only merging. Synthetic golden fixtures cover shared setup, independent roots, cleanup failure, UUID/path/port normalization, and redaction.
