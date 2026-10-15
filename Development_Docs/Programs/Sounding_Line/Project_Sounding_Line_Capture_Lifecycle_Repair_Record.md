---
title: Sounding Line capture helper lifecycle repair
audience: engineering
status: implementation-under-qualification
canonical_for: sounding-line-capture-helper-lifecycle-repair
last_reviewed: 2026-10-14
---

# Capture helper lifecycle repair

The repair is limited to protected capture process supervision and publication.
Its accepted source base is `602f83efdb16b7ea75980f07fa3a3d976c496860`.
Product contracts, viewport screenshot geometry, review requirements and
Mainline Decision semantics are preserved.

## Established faulty boundary

[Crossdeck preparation run 38316566108](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38316566108)
completed all 32 contexts and its capture child exited 0. At 22:36:31.927 UTC
server cleanup began; at 22:36:36.928 UTC it reported EXIT_NOT_OBSERVED for
PID 3916. The helper then reported no failure. Cancellation at 23:05:43.009 UTC
occurred 29 minutes 6.081 seconds later; uploads and Mainline Decision were skipped.
The original run remains cancelled and is never acceptance evidence.

Accepted `stop()` sent SIGTERM once, waited at most five seconds and discarded
the timeout outcome. It neither escalated nor verified streams or descendants,
and returned immediately for an already exited parent. Its result could thus
claim success while a ChildProcess handle kept the calling Node event loop
alive. `experience-browser --run-server` returned normally, unlike the authority
CLI's flushed explicit exit path. These interacting supervisor/completion
defects establish the infrastructure root cause. The historical logs do not
identify which internal Next shutdown await stayed pending; claiming that
specific request/socket would exceed the available evidence. Current Next
production shutdown awaits HTTP server closure and internal server closure;
the supervisor must handle an application that never completes either.

## Correction and ownership

Every payload launch establishes ownership before asynchronous readiness:
Linux uses a dedicated subreaper guardian, process birth identities and kernel
pidfds for signals; Windows creates the payload suspended, assigns a
kill-on-close Job Object and resumes it only after assignment. Windows job
membership survives reparenting. Linux terminates direct owned children and
iteratively adopts/reaps their descendants, including descendants that create
a separate session or clear their environment. Only the live guardian's
immediate children are signalled; ownership is never joined through stale
intermediate PIDs. Kernel ECHILD, after waitpid reaping, establishes that no
owned descendants remain.
Linux requires readable task-owned procfs and Python 3 with pidfd support;
unsupported/incomplete observation fails cleanup rather than claiming success.

Exit/error observation is registered at creation and rechecks cached exit
state after subscription. Browser, fixture and application processes have
separate cleanup receipts; proxy incoming/upstream sockets are tracked and
closed. Graceful termination is followed by forceful termination, direct-child
exit/stream closure and independent loopback-port release checks. No process
is selected by its executable name or port. No external/shared database,
browser state, runtime lock or lease is acquired by the helper. Guardian
receipt directories are removed; capture artifacts and source-bound isolated
database/output directories remain caller-owned evidence, never broad cleanup
targets.

Default teardown is bounded per process to two seconds graceful, three seconds
forceful, two seconds orchestration and one second stream verification, with
at most 0.5 seconds for the Windows receipt directory. Processes clean up in
parallel. Proxy cleanup is bounded to one second; port verification to one
second per port. Active execution has a fifteen-minute cap. Cancellation during
startup, execution or teardown reaches the same cleanup path; a second signal
cannot interrupt escalation. A failed cleanup remains an explicit terminal
failure, even when capture exited 0. The runtime receipt records execution,
cleanup and port facts separately; existing artifact integrity/review/authority
validation still owns later acceptance.

Both CLI entry points persist `browser-runtime.json`, flush the truthful
terminal receipt and exit. The existing workflow attempts capture/diagnostic
uploads even after failure; partial uploads never turn a failed job into
trusted capture acceptance. The focused Linux qualification job is explicitly
non-authoritative. Final acceptance must use the existing protected-main
workflow and unchanged required check.

## Validation and integration status

Local Windows qualification: 115 Sounding Line tests plus the added targeted
missing-payload regression; 14 observable
process lifecycle scenarios; real production Next/Chromium capture through
`experience-browser --run-server`; active Chromium failure and cancellation.
The production fixture verifies artifact bytes against recorded hashes and
the caller's terminal result, descendant/stream cleanup and released ports.
The full rendered suite passed 11 tests, including the accepted viewport
preservation regression. Typecheck, focused lint, privacy scan, documentation
validation and Feature Catalog synchronization/validation passed.

Independent source review resolved the ownership, PID-reuse, Windows stdin,
supervision attribution and test-cleanup findings; no blocking source findings
remain before focused Linux qualification. Source review is separate from
execution proof.

Linux hosted qualification, final source binding, protected acceptance,
merge and landed smoke are pending. Their exact identities and timings will
be recorded after execution. This record does not claim consumer acceptance.

Feature Catalog: no capability change; this is an ordinary infrastructure
correction. Consumer capture remains separately owner-authorized.
