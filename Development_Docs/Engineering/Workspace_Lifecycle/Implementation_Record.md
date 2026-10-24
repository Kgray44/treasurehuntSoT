---
title: Automatic workspace lifecycle implementation record
audience: engineering
status: current
canonical_for: automatic-workspace-lifecycle-implementation
last_reviewed: 2026-10-23
---

# Automatic workspace lifecycle implementation record

This infrastructure increment implements one external ownership registry for
temporary linked Git worktrees and non-Git runtimes, finite admission budgets,
terminal cleanup, recoverable retirement and durable preservation receipts.
Operational instructions belong in [the automation workflow](../../../.agents/workspace-lifecycle.md).

The initial live Git inventory contained 129 registered worktrees. The historical
147 count is not the current baseline. The tracked protected-main checkout
contained 5,915,721,234 logical bytes before dependency/build overhead; a 12 GiB
initial workspace allocation supports that measured source with finite headroom.
The aggregate admission ceiling remains 75 GiB, and each of C: and D: must remain
strictly above 32,212,254,720 free bytes after estimated writes. No limit increases
automatically in response to spare disk capacity.

Development reused the inactive repository-cleanup workspace. Its existing
partial dependency directory and the canonical checkout's unrelated changes were
preserved. Focused fixtures use fresh synthetic repositories and real worktree
creation/removal; their authority adapters do not represent protected GitHub
acceptance. The July 26 mirrored-validation incident was reviewed. The manager
does not mirror source, recursively traverse junction targets or delete shared Git
stores; actual linked checkout retirement uses Git's worktree operation.

The registry distinguishes measured logical file bytes, conservative rounded
allocation bounds and observed volume free-space changes. None is silently
presented as another. Receipts preserve failed cleanup outcomes; a platform denial
cannot become a successful retirement. Dirty unfinished source stays held while
explicitly registered generated roots can be released after terminal failures.

Acceptance remains in progress until focused tests, required repository checks,
protected integration, landed-source smoke, scheduling and a real automatic
post-merge retirement have all been independently observed. Installation and
historical cleanup measurements must be recorded before calling the system
operationally complete. Codex hooks retain their platform trust requirement;
standing cleanup authorization does not bypass it.

## Host verification

The 20-case focused suite passed on Windows, including real Git worktrees,
normal/squash/rebase source verification, a live process hold and release,
incoming shared junctions, and registered checkout aliases. Subsequent resource
class and host-binding regressions extend that suite before qualification.
Documentation validation and Feature Catalog synchronization/validation passed.
No completed-feature claim is made by this implementation checkpoint.

The limited per-user scheduled task executed successfully at 22:09 Eastern on
October 23, returning zero and writing an independent worker-run receipt. Native
file-handle inspection established that this packaged application's Local AppData
paths resolve under its package LocalCache directory. The initial task could not
see the logical installed path; the repaired installer verifies identical registry
file identities and binds the worker and the existing reserve guard to their
physical paths. It changes no task permissions and bypasses no platform policy.
Logon and 15-minute triggers are installed. Codex hook definitions are installed
and still require the platform's exact-definition trust review.

All five named NCL diagnostic workspace paths had already lost their Git pointers
and source before this manager's adoption. Fresh inspection found only released
generated residuals, which were subsequently emptied by concurrent recovery.
This manager classified and retired the five remaining non-Git runtime roots;
it does not claim those five Git checkout retirements or their historical payload
allocation as its own reclamation. The original 6,084 retained files and junction
descriptors passed a fresh independent verifier, and each runtime retirement
checked its external custody before and after removal. Original evidence maps,
outer evidence directories, the retained NCL source ref and active Parallax
resources remain outside retirement scope.

A later complete logical scan counted 123 registered checkouts and
237,474,663,114 file bytes before correcting physical-root accounting for the
Parallax alias. That is a lower-bound observation rather than a final aggregate
measurement. It already exceeds the 75 GiB admission limit, so additional managed
environments remain denied. Reusing the existing recovery worktree permits this
implementation without creating another hydrated development checkout. Initial
and final counts can also change through separately owned recovery work; receipts
attribute only actions performed by this manager.
