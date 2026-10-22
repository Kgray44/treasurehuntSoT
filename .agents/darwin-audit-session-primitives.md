---
title: Darwin audit-session capability primitive context
audience: automation
status: source-reviewed-not-host-qualified
canonical_for: darwin-audit-session-capability-primitive-context
last_reviewed: 2026-10-22
---

# Darwin audit-session capability primitive

This separate prerequisite supports the existing Sextant Phase 4 continuation.
Preserve the negative task-termination and positive three-child audit-token signal
probes and every original receipt. No production guardian, iOS Devices runner,
account, signing, provisioning or product behavior is changed by this experiment.

Use only the fixed `darwin-audit-session` development target on one ephemeral
GitHub-hosted macOS runner after independent review of the exact implementation.
Reject qualification tiers and caller scenario/profile overrides before external
operations. The `all` target must never select this job. Preserve strict C compiler
checks. No fallback, warning suppression, parameter search or equivalent retry.

The observer keeps its original audit session. It creates two known direct
children and at most one known grandchild, with exactly three required for a
complete successful observation. Every child has its own five-second alarm;
A/B have four-second natural windows and the grandchild a one-second window.
The observer has a thirty-second alarm. Establish checked SIGCHLD default behavior
without SA_NOCLDWAIT before creating children; keep direct children unreaped until
their creation-bound task handles are acquired and checked.

Initial numeric ASID lookup is forbidden. Establish the private Mach endpoint
through the known unreaped direct children's checked task handles. With each
single-thread child blocked, require `KERN_INVALID_NAME` from the fixed-name slot
check before insertion; any other result or insertion collision fails without
trying another name. The child sends its own `audit_session_self` capability in
one fixed complex message. Require the exact receiver ABI, one normalized
`PORT_SEND` descriptor, aligned bounded audit trailer, known-child kernel
PID/generation, and body/trailer ASID equality. Sender disposition is `COPY_SEND`.
The trailer authenticates the sender; independently review descriptor provenance
from the fixed child implementation. No unexpected reply, voucher or OOL data.

Only while the exact received session right is held may an observer look up that
authenticated ASID. Require the same local port identity. Release both child task
handles before the later held-session phase. Track every acquired send-right user
reference, including aliases, and clean up received messages exactly once on all
success and failure paths. A malformed or partial frame is a failed experiment.

A uses one fixed, checked currently absent numeric UID/GID after dropping all
other groups; current absence is not an exclusive UID lease. Verify real,
effective and saved identities, the entire group set and denied root restoration.
Privilege negatives must be valid requests against a known held session or a new
session assignment. Verify unchanged audit identity through the drop, grandchild
fork and `setsid`; require A's actual grandchild wait status. The observer sends
no process signals, never enumerates unrelated sessions and creates no account
or audit configuration. Children retain their independent natural deadlines.

Retain source-bound fixed redacted observations. Do not export raw ASIDs, PIDs,
UIDs, audit tokens, credentials, general inventories or private content. Distinguish
API outcome, actual child wait status, right/pipe release and binary/directory
cleanup. Unavailable APIs or any missing observation fail without global changes.

Even a positive result establishes only bounded session identity/retention. It
does not establish arbitrary descendant ownership, service containment, hardened
process signaling, global emptiness, forced identifier reuse, guardian loss or
cancellation, stream/port closure, artifact custody or Chromium/CoreSimulator use.
Those still require separately reviewed implementation, adversarial execution and
protected installation. No product, physical or owner acceptance follows.
