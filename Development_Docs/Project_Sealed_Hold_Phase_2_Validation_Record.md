# Project Sealed Hold Phase 2 Validation Record

## Current evidence

| Gate | Command | Result |
| --- | --- | --- |
| Full Vitest | `node .../vitest.mjs run --reporter=dot` with a 600000 ms foreground timeout | Passed: 101 files, 897 tests, exit 0, 92.95 s (2026-07-22). |
| Worker contract | `vitest run tests/private-content/worker.test.ts tests/private-content/phase2-contracts.test.ts` | Passed: 2 files, 11 tests. |
| V1/canonical focused | `vitest run tests/private-content/package.test.ts tests/private-content/materialization.test.ts tests/private-content/phase2-contracts.test.ts` | Passed: 3 files, 16 tests. |
| SQLite materialization proof | `tsx scripts/private-content/phase2-materialization-proof.ts` against isolated migrated SQLite | Passed: draft, published, archive, V1 service flow; zero `foreign_key_check` findings. |

The full suite emitted existing jsdom `act(...)`, canvas, animation-ownership, and forward-ref diagnostics. It exited zero with no test failures.

## External integrations

Docker, MySQL client/service, MinIO, and ClamAV were absent from the execution environment. Live MySQL, S3-compatible/MinIO, ClamAV, and Docker integration are not passed; their provider-neutral adapters and deterministic tests remain the locally attainable evidence.

## Governed format limitation

The frozen v2 frame format specifies authenticated transport framing but does not specify payload-record serialization or passphrase-to-stream-key derivation. A durable v2 import/export handoff would require a shared-contract amendment; it is tracked in the ledger as `blocked-governing`, not represented as implemented.
