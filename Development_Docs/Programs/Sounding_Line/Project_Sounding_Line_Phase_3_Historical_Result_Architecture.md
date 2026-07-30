---
title: Project Sounding Line Phase 3 Historical Result Architecture
audience: engineering
status: current
---

# Historical result architecture

The future canonical historical store is separate from product databases and the Prisma schemas. Conceptual aggregates are `HistoricalRun`, `HistoricalPlan`, `HistoricalPlanNode`, `HistoricalSuiteExecution`, `HistoricalTestCaseExecution`, `HistoricalAttempt`, `HistoricalResourceWait`, `HistoricalResourceAllocation`, `HistoricalFailure`, `HistoricalFailureSignature`, `HistoricalEvidenceArtifact`, `HistoricalCleanupOutcome`, `HistoricalEnvironment`, `HistoricalPerformanceSample`, `HistoricalPolicySnapshot`, and `HistoricalSourceSnapshot`.

Every retained record binds run ID, plan digest, source watermark, policy version/digest, suite and test-case version, executor/fixture/environment/provider/browser/database-baseline/resource-contract identities, retry, cleanup receipt, and final outcome. Phase timings are queue, provision, setup, execution, teardown, and cleanup start/completion timestamps; derived queue/provision/setup/execution/teardown/cleanup/node-wall/run-wall/critical-path/resource-wait milliseconds are calculated, never accepted as unverified authority.

Final Phase 2 ingestion is additive: the adapter accepts version-1 run marker/controller token, plan/policy/source digest, adapter/lane, conjunctive process identity, server/browser/context, SQLite baseline/clone, bounded output/exit code, leases, and cleanup/quarantine receipt. Existing event timestamps are preserved verbatim. Missing queue, allocation, setup, teardown, cleanup, lane-wall, run-wall, or resource-wait timing becomes `UNKNOWN` with `MISSING_ADDITIVE_FIELD`; it is never converted to zero. The ingestion record is `phase3-preparation/phase2-ingestion-v1`, allowing future historical-store migrations without changing a Phase 2 receipt.

Retention is `EPHEMERAL_DIAGNOSTIC`, `SHORT_TERM_EXECUTION`, `LONG_TERM_PERFORMANCE`, `LONG_TERM_FAILURE_SIGNATURE`, `RELEASE_EVIDENCE`, or `SECURITY_RESTRICTED`. Records reject credentials, cookies, tokens, raw environment values, private Chronicle prose, answers, locations, traces, raw database rows, and protected media. Versioned migrations are append-only, checksum-bound, and must be tested before the store is created in a future phase. The preparation prototype validates canonical serialization, identity, timing order, schema version, and secret-like fields using synthetic input only.

Statistics classify samples as `VALID_COMPARABLE`, `VALID_COLD_START`, `VALID_DEGRADED_HOST`, `VALID_EXTERNAL_PROVIDER`, `INVALID_EVIDENCE`, `CANCELLED`, `BLOCKED`, `ENVIRONMENTAL_OUTLIER_RETAINED`, or `POLICY_EXCLUDED`; no statistic lowers required evidence.
