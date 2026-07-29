# Failure Classification and Evidence

Classes are `product-defect`, `test-defect`, `fixture-defect`, `environment-defect`, `dependency-layout-defect`, `generated-artifact-defect`, `provider-unavailable`, `external-blocker`, `infrastructure-contention`, `timeout`, `flake`, `cascade-blocked`, `policy-violation`, and `unknown`. A root result is independently executed and owns its failure; a dependent whose prerequisite failed is blocked, not failed independently.

```text
Setup contract failed: 1
Independent product failures: 3
Tests blocked by setup: 87
Unknown failures: 0
```

This must never be flattened to “91 failed.” A receipt contains run/plan ID, command, commit/branch, source checksum, environment/runtime versions, selected/skipped suites and reason, leases, start/end and queue/setup/execute/teardown timing, count/outcome, classification/signature, retry/flake status, stdout/stderr, traces/screenshots, database and artifact checksums, cleanup, and gate decision. Paths and logs are redacted under the security policy.

Current isolation reports already prove canonical SQLite family preservation, isolated mutation, server nonce, and browser outcome. Sounding Line normalizes such evidence without claiming the future receipt service exists.
