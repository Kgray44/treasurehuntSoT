---
title: Immutable successful recognition read reuse
audience: engineering
status: prepared-awaiting-protected-qualification
canonical_for: immutable-recognition-read-reuse-repair-20261022
last_reviewed: 2026-10-22
---

# Immutable successful recognition read reuse

## Source-bound implementation decision

Protected main is `39b706ad3c9a2b8e1d589f71db909cf6c32c468b`. Its recognizer
blob is `b95e1118513e93c9a28f6356367c6f7bdd65f15b`; the exception registry is
`089308bf475a2b22bfdc64ac46164996855e7010`. The existing maintenance owner
prepared and independently reviewed one external development comparison against
Native candidate `be9abdac95279ea1e4f67b23221027ba19bd6e68`.

All 13 cases, 48 subcase comparisons and 96 arm outcomes passed independent
review. Each healthy arm made 157,505 logical requests, visited all 79 original
ordered records, and returned false with no matching record. The original arm
made 157,505 backing-reader calls; successful immutable-read reuse made 2,785.
Both order digests were
`cc3d53d8f33213f85b0f9e124aae1a3900d571ca8800bd589de451306ad08485`.

This supports preparing a narrow production candidate under ordinary protected
qualification. It does not prove native Git speed or explain cancelled hosted
run `39788400044/1`. That run remains cancelled with unknown cause. Resolver
elapsed time is not a Linux or unmodified native-Git measurement. Local Node
24.18.0 differs from the declared hosted 24.19.0.

The retained external handoff `equivalence-reviewed-handoff.original.json` is
6,214 bytes, SHA256
`af212823f16ce069eef7afc45e5c1278e91072a8b3c865b14f3b0432a92773c4`.
Independent result review `independent-equivalence-result-review.original.json`
is 30,336 bytes, SHA256
`68620e0bb2488b2c09fdca5a05162f5b48127f95fb712e6205ec372414e489fc`.
Original failed, unsupported, challenged and cancelled receipts remain separate
and unchanged. The completed comparison is not repeated for this repair.

## Candidate boundary

Only `recognizeExceptionExecution` establishes a fresh synchronous read scope.
Its existing decision body, ordered records and short circuits are retained.
The existing Git helper uses the original diagnostic reader on every miss.
Other callers retain their existing direct-read behavior outside this scope.

The reader retains complete successful raw strings or buffers for declared
full-SHA public selectors, immutable inventories and successful ancestry reads.
Root, argv and material options form the key. Mutable refs, private or unsupported
shapes, material environments, inherited output and unknown options pass through.
No new diagnostic operation is admitted. Cached buffers are copied for callers.
Successful empty absence remains distinct from a thrown read failure.

Errors propagate unchanged and are never cached or retried. Original catches
still decide whether a failed ancestry probe means false; that derived result
is not retained. JSON parsing, validation, historical/live clock checks and
all downstream grants, custody, phase, expiry and execution gates remain outside
the raw-value cache.

Every return or throw clears the scoped reader, including inherited async
contexts. Nested recognition has a separate scope. A changed backing function
passes through rather than sharing another reader's values. Retention is bounded
to 4,096 entries and 64 MiB of raw payload; exhaustion uses the original read.
These are cache-retention bounds, not a process RSS guarantee or an increase to
any existing read, execution or qualification ceiling.

## Focused evidence and remaining gate

The new eight-test suite passes on the D-owned Windows worktree. It exercises
actual native Git values, missing paths, directory metadata, a changed HEAD and
native errors; an inert one-record call through the production recognizer;
error identity and explicit later success; material keys and buffer isolation;
unsupported passthrough; cache exhaustion; reparsing malformed bytes; and scope
cleanup after return, throw, nesting and inherited async work. This is separate
production integration evidence, not another full 79-record comparison.

A selected existing Windows admission/diagnostic run reached its 180-second
outer limit. Four diagnostic cases completed; the admission file had no retained
terminal results. Its exact stalled subphase is unknown. The partial output and
original timeout receipt remain nonaccepting evidence; Windows Job Object
cleanup passed. No timeout or original assertion was changed. Complete admission
results remain mandatory in the frozen protected Linux qualification.

The canonical Sounding Line suite retains every accepted test and adds this
file once through `test:sounding-line`. Other package fields and the original
admission, expiry, missing-plan and diagnostic assertions remain unchanged.

Before installation, require exact-source independent review and one ordinary
protected qualification from accepted main. The accepted workflow classifies
this as control-plane work and runs the candidate's complete Sounding Line
regressions, typecheck, rendered adversarial fixtures, lint, privacy,
documentation and Feature Catalog tests. Modified source cannot approve itself.
Merge only after the exact required Mainline Decision passes, then independently
verify the landed source and bounded smoke evidence. No consumer capture,
reservation, retry, acceptance or physical-device claim follows from this repair.

This is performance work preserving capability; no Feature Catalog fragment
change is required.
