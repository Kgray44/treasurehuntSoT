# Project Sounding Line v1.4 — Prompt 4 Validation Record

Status: local focused validation only; no authority operation was dispatched.

## Focused command

```text
C:\Users\kgray\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --test tests/sounding-line/v14/mainline-train.test.mjs
```

Result: 24 focused v1.4 tests passed, 0 failed (including 7 Prompt 4 train tests). The focused adversarial coverage exercises deterministic ordering, frozen and record-only admission, repeatable prediction, conflict suffix brakes, same-tree/different-commit acceptance, tree/method/missing/stale comparison brakes, head/middle/final mutation and withdrawal boundaries, evidence revocation, policy drift, illegal transitions, external-main equal-tree and unexpected-tree recovery, migration collision detection, emergency-preemption audit, persistence/reload and tamper rejection.

Measured local in-process synthetic controller time was 107.138 ms for the focused seven-test matrix. This is not a hosted throughput claim.

Authority isolation was verified by source boundary: the new module imports only v1.4 foundation/fast-channel helpers and Node filesystem utilities; it has no GitHub client, workflow dispatch, `git push`, `update-ref`, merge API, or `RELEASE_GO` implementation. Tests use injected deterministic integration fixtures and temporary local state only. No protected ref was modified.

Deliberate limitation: Prompt 4 supplies local adapters/interfaces and synthetic receipts only. Binding to GitHub protected physical landing and production emergency authorization is intentionally deferred to Prompt 5.
