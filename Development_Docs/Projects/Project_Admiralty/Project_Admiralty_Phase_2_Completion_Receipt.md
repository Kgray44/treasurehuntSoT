---
title: Project Admiralty Phase 2 Completion Receipt
audience: product-owner-engineering-security-quality
status: current
canonical_for: project-admiralty-phase-2-completion-receipt
last_reviewed: 2026-08-12
---

# Project Admiralty Phase 2 completion receipt

## Disposition

`OWNER_ACCEPTED_MAINLINE_CANDIDATE`.

Current-main reconciliation is anchored by merge
`0373aa0a63208c5bd24f53f8d751aed2b109c345`, which preserves the
owner-accepted Chartroom and incorporates accepted `origin/main`
`191a964488d0df71f8dcb91c5b8372fc73b6b32e`. The current branch head, rather
than any historical receipt, is the only source eligible for the next Mainline
Decision.

The read-only Chartroom implementation is reconciled with accepted
`origin/main` at `54e3d818d49d45282a9c419d562d4b5c78911ccd` by merge
`927c54990`. It retains the latest mainline Studio and Sounding Line
improvements while preserving authority boundaries. The prior hosted runs
identified narrowly-scoped test preparation, workspace-link isolation, and
Studio assertion timing defects, each repaired on this branch. Sounding Line
authoritatively accepted frozen candidate
`894eaec061665c4f1b9c50bf7c84ad766551c7e5` against base
`54e3d818d49d45282a9c419d562d4b5c78911ccd` in run `31572661444`: the
finalizer issued `RELEASE_GO` from 38 mandatory clean receipts. The narrow Helm
browser repair then requalified frozen candidate
`fdafed62ceba92a09014abb288ec27beeed830f1` against the same base in run
`31577075177`; its finalizer also issued `RELEASE_GO` from 38 mandatory clean
receipts. A documentation-only exact-head retry in run `31578742514` then
exposed a second Helm browser race: the test relied on a transient participation
notice after a successful action. The test now waits for the authoritative
participation response and refreshed voyage-card state. A fresh Sounding Line
Mainline Decision is required for that repaired exact source; earlier
`RELEASE_GO` receipts remain historical only. That retry also exposed an
independent Sounding Line controller lost-update race: a heartbeat could
overwrite a concurrent cancellation request. The durable run store now
serializes updates and has a concurrent-cancellation regression test. The
combined repaired source `b32a3c961bdd4b4a743a73b7d226f6cd14db9d1c` then
received `RELEASE_GO` in run `31581152448` against the same base, from 38
mandatory clean receipts and zero unclean receipts.

The hosted `browser.admiralty` receipt passed on that candidate, alongside all
other sealed suites, with clean runtime conformance and synthetic-only database
isolation. The task-owned owner walkthrough was re-prepared for `b32a3c961...`,
and the owner accepted it on `2026-08-12`; see
`Project_Admiralty_Phase_2_Owner_Decision_Record.md`. This receipt must not be
interpreted as canonical-main availability until the current reconciled source
earns a fresh exact-source Mainline Decision and protected merge.

## Acceptance boundary

The owner-acceptance boundary is satisfied. Canonical-main integration now
requires a fresh exact-source Mainline Decision for the current reconciled
source and a successful protected-merge binding. Phase 3 is not authorized.
