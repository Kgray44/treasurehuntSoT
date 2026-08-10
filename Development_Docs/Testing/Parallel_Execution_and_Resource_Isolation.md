# Parallel Execution and Resource Isolation

Parallelism is earned by isolation. Static analysis, pure unit suites, independent component fixtures, distinct database clones, distinct browser servers, and separate build directories are naturally parallel. A shared mutable database, port, storage root, generated client, scanner account, or process host is not.

## Lease contract

A lease record contains `resourceClass`, `resourceId`, `runId`, `ownerProcessId`, owner creation time, acquired/renewed/expires timestamps, heartbeat, capacity slot, cleanup policy, and evidence path. Acquisition is atomic; collision reports the current holder without exposing secrets. Renewal fails closed on owner mismatch. Stale recovery first proves the recorded process identity is dead and verifies the resource is in the lease's managed root. Cancellation releases only verified owned resources.

| Class                  | Current boundary                                       | Future allocation                                                            |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Node/install/Prisma    | shared validation runtime and repeated generation      | immutable cache plus provider/schema-specific writable generated-client slot |
| SQLite                 | one nonce-marked copied database inside global harness | checksum baseline + `sqlite:<baseline>:<run>` clone                          |
| MySQL                  | external ordered rehearsal                             | `mysql:<environment>:<run>` schema/database with migration/runtime accounts  |
| app/restart port       | fixed 3100/3200                                        | leased loopback port with process ancestry proof                             |
| browser                | one Playwright worker                                  | browser project/shard plus DB/server/root lease                              |
| filesystem             | runtime artifacts and configurable roots               | marker-owned run/storage/media/private/object namespace roots                |
| build/scanner/provider | shared process/configuration boundaries                | capacity or named external-provider lease                                    |

```text
Run A: port 3211, SQLite clone A, Chromium shard 1, media root A
Run B: port 3212, SQLite clone B, Chromium shard 2, media root B
Run C: no server, no browser, Vitest shard 4
```

Prohibited: multiple browser workers sharing a mutable DB unless the suite declares it; task branches sharing a writable storage root; tests on canonical development data; fixed ports without a lease; deletion of another run's artifacts; broad serialization of static/unit work; and silent fallback to a shared DB. Current `validation-runtime.lock` remains until its runtime/baseline/port protections are replaced by these narrower leases.

Acceptance is concurrent independent browser/database work with collision-free receipts, process cleanup, baseline checksum preservation, and no unowned port/artifact deletion.

## Version 1.1 shared validation queue

Scarce resources are scheduled by a broker-owned queue, not manual task/chat diplomacy. Each immutable request records source, base, plan, gate, priority, fairness age, required bundle, state, and block reason. A source guard verifies the exact candidate and material mainline movement immediately before expensive acquisition; stale work is cancelled and replanned outside the lane. Active work is not ordinarily preempted, fairness aging prevents starvation, cleanup completes before automatic handoff, and compatible fully isolated lanes may run concurrently. Do not delete a lock or seize a lease to advance a queue position. Queue, setup, execution, teardown, and finalization timing remain separate. A contended workstation qualifies timing evidence and routes timing-sensitive proof to a hosted/reference environment; it does not prove a product failure.
