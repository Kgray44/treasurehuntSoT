---
title: Project Sounding Line Phase 3 Flake Stale and Slow Suite Governance
audience: engineering
status: current
---

# Flake, stale-test, and slow-suite governance

Flake states are `SUSPECTED`, `REPRODUCIBLE_INTERMITTENT`, `ENVIRONMENT_DEPENDENT`, `RESOURCE_COLLISION`, `ORDER_DEPENDENT`, `TIMING_DEPENDENT`, `PROVIDER_DEPENDENT`, `TEST_DEFECT`, `PRODUCT_RACE`, `QUALIFIED_FLAKE`, and `RESOLVED`. Qualification requires repeat evidence, owner, expiry, release effect, compensating coverage, and review; a retry pass is visible but not a clean pass.

Stale classes are `INTENTIONAL_BEHAVIOR_CHANGE_TEST_NOT_UPDATED`, `OBSOLETE_ARCHITECTURE_ASSUMPTION`, `RETIRED_SURFACE`, `FIXTURE_SCHEMA_DRIFT`, `LANGUAGE_ONLY_DRIFT`, `INVALID_ASSERTION_DETAIL`, `PROTECTED_CONTRACT_REGRESSION_NOT_STALE`, and `UNKNOWN_REQUIRES_REVIEW`. Behavior and test updates remain one task; protected regressions cannot be relabeled stale.

Slow records expose queue/provision/setup/execution/teardown/cleanup/wall/critical-path/resource wait/cold-warm/first-pass metrics and diagnose the bottleneck. Allowed remediation is splitting, setup/fixture/route/cleanup/worker/test-algorithm improvement or owned exception; weakening assertions, skipping coverage, mock substitution solely for speed, and timeout inflation without diagnosis are prohibited.
