---
title: Sounding Line Darwin audit-token signal feasibility
audience: engineering
status: investigation-not-implementation
canonical_for: sounding-line-darwin-audit-signal-feasibility-20261021
last_reviewed: 2026-10-21
---

# Sounding Line Darwin audit-token signal feasibility

The [prior task-port experiment](Sounding_Line_Darwin_Process_Primitive_Feasibility_20261020.md)
cannot terminate ordinary BSD processes. Its failed calls and five original
evidence files remain unchanged. This separate software prerequisite examines
an audit-token BSD signal operation using only finite direct children on hosted
macOS. It does not implement or accept a cleanup guardian. No personal hardware,
Apple account, signing or provisioning is needed.

Apple's macOS 15 era source declares the symbol and returns an errno value on
failure. The kernel requires a positive valid signal, resolves the audit token's
PID and process generation, and rechecks process identity before signaling. The
probe therefore uses SIGTERM rather than signal zero and tests a changed
generation before exercising the valid token. These source observations are
feasibility inputs; SDK compilation and hosted behavior still require evidence.
[Library implementation](https://github.com/apple-oss-distributions/xnu/blob/xnu-11417.140.69/libsyscall/wrappers/libproc/libproc.c#L461-L470),
[kernel signal checks](https://github.com/apple-oss-distributions/xnu/blob/xnu-11417.140.69/bsd/kern/proc_info.c#L3359-L3416),
[generation lookup](https://github.com/apple-oss-distributions/xnu/blob/xnu-11417.140.69/bsd/kern/kern_proc.c#L416-L438).

## Fixed observation

The development-only `darwin-audit-signal` target creates one compiled root child,
one compiled child under an unregistered numeric UID and one fixed `/bin/sleep`
child under that UID. Each owns a five-second alarm and four-second natural exit.
The parent has a 30-second alarm. No account is created, and current UID absence
is not an exclusive lease. Admission rejects qualification tiers and arbitrary
scenario/profile overrides before any external operation.

Each case requires readiness, expected image, direct parent and real/effective/
saved UID checks, plus an acquired task audit token matching the known unreaped
child. A token with only its generation changed must return ESRCH without reaping
the child. Only then may the actual token receive SIGTERM. A positive result
requires API success and an actual SIGTERM wait status, rather than natural exit
or alarm. The post-reap token must return ESRCH. No PID reuse is forced. Only
fixed labels, public source identity, API results, booleans, wait status and
elapsed time are exported; raw PIDs, UIDs and audit tokens are omitted.

The workflow records binary and private-directory removal separately from the
primitive result and direct-child cleanup. No numeric-PID signal fallback,
UID-wide kill, detached process, browser, CoreSimulator or private content is
involved. Independent read-only source review by the separate
`/root/sextant_source_review` context found no blocking issue in this bounded
probe. The two focused admission tests pass, including rejection of both
qualification tiers and caller overrides before external work. The workflow
template parses and its fixed macOS/timeout gate checks pass. Hosted SDK
compilation and actual primitive observation remain pending at this stage.

Documentation index generation, documentation validation and Feature Catalog
synchronization/validation pass. Index generation also reproduced unrelated
historical Ledgerlight inventory rows; their exact generated diff was retained
outside the repository and those unrelated rows restored. The owned document's
generated index entry is retained. No major product feature changes.

## Acceptance boundary

All ownership-implementation and product-acceptance claims remain false. Even a
positive observation would leave exclusive creation-bound ownership, detached
descendants, services, guardian loss/cancellation, inherited streams, ports,
artifact custody and actual Chromium/CoreSimulator operation unproved. The
production guardian and normal iOS Devices runner remain unchanged. Existing
provider, emulator and simulator matrices are not repeated by this experiment.
