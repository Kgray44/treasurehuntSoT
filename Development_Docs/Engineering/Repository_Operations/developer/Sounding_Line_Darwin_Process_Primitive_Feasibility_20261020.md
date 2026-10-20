---
title: Sounding Line Darwin process primitive feasibility
audience: engineering
status: investigation-not-implementation
canonical_for: sounding-line-darwin-process-primitive-feasibility-20261020
last_reviewed: 2026-10-20
---

# Sounding Line Darwin process primitive feasibility

Sextant's normal iOS Devices development run builds successfully but cannot prove
runtime cleanup with the current Linux-only guardian. The retained run
`39311000104` reports the missing Darwin containment result. Existing simulator
permission/geofence evidence remains separate. This is an internal software
prerequisite; manual Apple account, signing and personal hardware are not inputs
to this investigation.

Preparation starts from protected main
`c0b29d78f7b4c6137c9eb393a10dd9a2112e68ed` in an owned worktree. The fixed
`darwin-primitives` development target observes access to Mach task ports for
three finite direct children: a compiled child, an unregistered numeric-UID
compiled child and a fixed platform executable under that UID. It records only
source identity, known case names, bounded API result numbers and boolean identity
and direct-child cleanup observations. Task-port denial waits for the child's own
deadline. No numeric-PID signal, detached descendant or arbitrary command is used.

Apple documents restrictions on obtaining task ports, including protected
processes. Root access alone must not be assumed to solve real browser or
CoreSimulator cleanup. The experiment does not disable those restrictions.
[Debugging entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.debugger),
[runtime protections](https://developer.apple.com/library/archive/documentation/Security/Conceptual/System_Integrity_Protection_Guide/RuntimeProtections/RuntimeProtections.html).

Independent source review identified two Darwin API assumptions before dispatch.
A null `proc_listpids` buffer reports allocation capacity before UID filtering;
the observer instead uses a bounded actual buffer and refuses ambiguous results.
Darwin group enumeration includes the effective group; the child explicitly sets
and verifies only the intended group instead of assuming zero returned groups.
The real, effective and saved UID/GID fields are checked before a task-port query.
[Process enumeration source](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/proc_info.c),
[credential source](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/kern_prot.c).

The admission regression passes one test covering rejection of qualification
tiers and scenario/profile overrides before any external tool starts. The macOS
SDK compilation and actual primitive observations completed in hosted run
`39380061140` at exact source `84feecb88f67c9e34475905642794e60bdbd64cb`. No product
browser, native app, user account, port or private content is created by this
probe. Existing production guardian and iOS Devices code remain unchanged.

Even a successful primitive observation would not establish a usable guardian.
The remaining design must prove exclusive creation-bound ownership, safe task
identity, detachment and service behavior, independent browser/server leases,
guardian loss and cancellation, closed streams, empty resources, private-artifact
ownership and actual Chromium/CoreSimulator operation. No weaker cleanup result
or acceptance follows from this feasibility experiment.

## Completed primitive observation

The [five original files](../evidence/20261020-darwin-primitives/publication-index.json) preserve both downloaded artifacts, dispatch, hosted receipt and full run log. Independent review recomputed artifact hashes and the C source hash against the frozen Git tree. The actual host reports macOS15.7.9/24G830, arm64. All three children pass readiness, expected-image and real/effective/saved-credential checks. Task-port access and audit-token identity both succeed; every `task_terminate` call returns5. Direct children were reaped and the two isolated numeric UIDs were empty at observation. The root case does not assert global-root emptiness. Exit/signal status and per-call elapsed time were not exported, so exact natural-exit versus alarm behavior is unproved. Workflow success means the bounded observation completed, not successful task termination.

Apple's macOS15-era [task implementation](https://github.com/apple-oss-distributions/xnu/blob/xnu-11417.140.69/osfmk/kern/task.c#L2345-L2356) explicitly returns `KERN_FAILURE` for tasks with a BSD process. This primitive cannot implement ordinary BSD process termination. No equivalent repeat, entitlement change or runtime-protection change follows. A separate audit-token BSD signal primitive requires SDK/symbol availability and independently reviewed direct-child proof before any ownership design. All guardian acceptance flags remain false.
