---
title: Darwin audit-session capability experiment
audience: product-engineering
status: source-reviewed-not-host-qualified
canonical_for: sextant-darwin-audit-session-capability-experiment-20261022
last_reviewed: 2026-10-22
---

# Darwin audit-session capability experiment

This bounded prerequisite supports the existing Sextant Phase 4 continuation.
It is a development experiment on an isolated branch from protected main
`408f37389e6dd358b1ab005d91f3f588405f61db`, with no production guardian or
consumer change. It preserves the earlier failed task-termination probe, the
successful direct-child audit-token signal probe, the original natural-entry
failure and their source-bound receipts. Phase 4 remains incomplete.

## Question and source boundary

Can an observer receive a known direct child's audit-session send right through
a private authenticated Mach message, retain that identity after the child exits,
and observe unchanged audit identity through a checked credential drop, fork and
`setsid`? This is narrower than containment or safe descendant cleanup.

The design was checked against Apple's pinned
[XNU audit-session implementation](https://github.com/apple-oss-distributions/xnu/blob/xnu-11417.140.69/bsd/security/audit/audit_session.c),
[session-port lifetime](https://github.com/apple-oss-distributions/xnu/blob/xnu-11417.140.69/osfmk/kern/audit_sessionport.c),
[audit syscalls](https://github.com/apple-oss-distributions/xnu/blob/xnu-11417.140.69/bsd/security/audit/audit_syscalls.c),
[public and private declarations](https://github.com/apple-oss-distributions/xnu/blob/xnu-11417.140.69/bsd/bsm/audit.h),
[kernel message trailers](https://github.com/apple-oss-distributions/xnu/blob/xnu-11417.140.69/osfmk/ipc/ipc_kmsg.c),
[port copyout](https://github.com/apple-oss-distributions/xnu/blob/xnu-11417.140.69/osfmk/ipc/ipc_object.c)
and [named port insertion](https://github.com/apple-oss-distributions/xnu/blob/xnu-11417.140.69/osfmk/ipc/mach_port.c).
These sources do not establish correspondence to the eventual hosted kernel,
SDK availability or a successful runtime observation.

The rejected first design began with numeric session lookup and did not establish
the required creation/lifetime binding. The replacement transfers the actual
child `audit_session_self` right before any numeric lookup. Its kernel trailer
must match a known unreaped child's checked task audit token and message ASID.
Before insertion into that blocked child's namespace, the single fixed name
must return `KERN_INVALID_NAME`. A collision fails without searching other names.

## Fixed scope and observations

The dedicated `darwin-audit-session` target permits only development runs and
rejects scenario/profile overrides before any external operation. Ordinary
`all` selection excludes the job. One macOS 15 job has a five-minute limit,
sparse source checkout and strict `clang -Wall -Wextra -Werror` compilation.
It installs only its own binary in a newly allocated private temporary directory.

The observer creates two known direct children and at most one known grandchild.
Each has a five-second alarm. Direct children have four-second natural windows;
the grandchild has a one-second window. The observer has a thirty-second alarm.
No observer-issued process signal, account creation, global audit configuration,
browser, simulator or arbitrary command is part of the probe.

Success requires the fixed complex-message ABI, normalized send descriptor,
bounded aligned audit trailer, kernel sender PID/generation and ASID binding;
the received B frame must fail A's identity guard even when its body role is A.
Both task handles must be released before later session-retention observation.
Every acquired send-right user reference, including aliases, is counted.
The observer releases its endpoint and all owned pipe ends. Actual child and
grandchild waits remain separate from API success and installation cleanup.
Unavailable final child records produce unknown observations rather than claims
that a grandchild did not exist or that cleanup succeeded.

The unprivileged child uses one fixed currently absent numeric UID/GID, drops
other groups, verifies real/effective/saved credentials and denies root
restoration. Negative session requests are valid requests for new assignment or
the other known held session. Current UID absence is not an exclusive UID lease.

## Current verification

Six focused development checks pass across the existing hosted-selection tests
and the new admission/selection tests. They exercise rejection before external
operations and confirm that only the dedicated target selects this finite job.
The first local test launcher failed before tests because Windows ESM imports
require file URLs; that failure was retained and the launcher path corrected.
Independent source review cleared the first finite development attempt against C
SHA256 `672a947451c4a4530c77d7b764bdbcc7c14db9d95e7c2e5accafb590fb6173f5`.
The reviewer confirmed that unavailable records remain unknown, actual reaping
is distinct from successful exit, and core API failures retain their operation,
return code and error without being overwritten during cleanup. A positive result would still have
`qualification: false` and would not authorize production guardian installation.

The first hosted attempt, [run 39783532658](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39783532658),
failed strict compilation on macOS 15.7.9 / build 24G830 with SDK 15.5. The SDK
deprecates `mach_port_destroy`; `-Werror` correctly stopped before installation or
child creation. The original failed run, compiler output, six-member artifact
`12428435286` (1,577 bytes, SHA256
`dfd935f462f7a4e9b10e308514680412dba8cd971023b4ee1cbed92ffc32dcda`)
and source `17f0a0049c2144d96336fa8a4bac0d2886f2f8c1` remain preserved.
Its temporary transport branch was removed only after independent remote absence
verification; source and all five transport objects remain retained.

The correction releases precisely the allocated receive right with
`mach_port_mod_refs(..., MACH_PORT_RIGHT_RECEIVE, -1)`, following the SDK's
supported API guidance. It retains strict compilation and the fixed experiment
scope. Independent re-review verified corrected C SHA256
`13ad543dc724e434a66ea0a1fd2b43237df9e89f1525806c462c9ae18b8bcee2`
and cleared one newly frozen finite attempt. No runtime feasibility has been
established by the original compiler failure.

This experiment cannot prove arbitrary descendant ownership, service containment,
global session emptiness, forced identifier reuse, hardened process signaling,
guardian loss/cancellation, stream/port closure, artifact custody or physical
device correctness. It changes no completed catalog capability.
