---
title: Project Wakebook Phase 1 Owner Walkthrough
audience: product-owner
status: current
canonical_for: project-wakebook-phase-1-owner-walkthrough
last_reviewed: 2026-08-09
---

# Project Wakebook Phase 1 owner walkthrough

## Acceptance boundary

This walkthrough begins only after the validation record says `READY_FOR_OWNER_WALKTHROUGH` and the retained task-owned runtime identity below is complete. Automated readiness is not owner acceptance. The walkthrough does not authorize a main merge, deployment, production data, public sharing, or Wakebook Phase 2.

## Runtime identity

| Field                      | Owner handoff value                                      |
| -------------------------- | -------------------------------------------------------- |
| Branch                     | `codex/project-wakebook-phase1-open-the-wake`            |
| Exact source SHA           | Pending final evidence commit                            |
| Runtime command            | Pending retained-runtime launch                          |
| Loopback URL               | Pending retained-runtime launch                          |
| Process ID and listener    | Pending retained-runtime launch                          |
| Task-owned database        | Pending retained-runtime launch                          |
| Synthetic owner identifier | Pending retained-runtime launch                          |
| Synthetic password         | Supplied interactively only; never stored in this record |
| Evidence root              | Pending final Sounding Line run                          |

Before beginning, verify the runtime process, port, source SHA, and database path match this table. Stop if the application points at a canonical or shared database.

## Walkthrough A: first arrival and ordinary reachability

1. Start at `/` in the retained browser runtime.
2. Sign in with the supplied synthetic owner account.
3. Use visible navigation to open **Chronicle Passport**.
4. Choose **History** on desktop, then repeat through the equivalent mobile section navigation.
5. Confirm the page identity is **Your Voyages** and **The Living Journey Archive**.
6. Confirm no URL editing or direct deep link was required.

Expected: authenticated ordinary navigation reaches the same private archive on desktop and mobile. The page does not present Timeline, People, Statistics, map, sharing, Tideglass, or other later-phase controls.

## Walkthrough B: many-Voyage archive and filtering

1. Read the total played-Voyage count and the first visible year heading.
2. Compare the year heading's total with the `Showing` coverage text; confirm the year total is larger than the first page when applicable.
3. Search for the named synthetic historical Voyage.
4. Open **More filters** and exercise state, year, participation, Memory, Keepsake, and artifact-context filters.
5. Change **Order** between newest and oldest.
6. Clear all filters in one action.
7. Use **Show more Voyages** and confirm cards continue without duplicates.

Expected: filters are understandable and clearable, the result announcement updates, pagination remains bounded, unknown dates/timing are labelled unavailable, and ordinary cards do not emphasize raw enums, internal IDs, or checksums.

## Walkthrough C: invitation and first-use truth

1. Inspect **Invitations along the way**.
2. Confirm its text says invitations are separate from played history.
3. Switch to the supplied first-use synthetic owner if provided.
4. Confirm the empty archive explains what will appear and offers **Discover Chronicles**, **Open an invitation**, and **Return to Chronicle Passport**.

Expected: invitation-only records do not change played counts, duration summaries, completion totals, artifacts, or chapter counts. First use is a purposeful orientation, not a blank grid or test-data control.

## Walkthrough D: one Voyage in depth

1. Open **The Lantern Below** through its visible **Open Voyage** link.
2. Inspect Journey Summary, Path Through the Chronicle, Crew, Artifacts, Exact Edition, and Remembrance.
3. Confirm timing says exact, approximate, unavailable, or not applicable rather than silently showing zero.
4. Confirm historical crew names remain the stored names for that Voyage.
5. In Artifacts, distinguish **Shared Voyage artifact moments** from **Your Artifact Cabinet records**.
6. Open **Edition provenance** and confirm exact version/checksum evidence is available but not dominant.
7. Add or edit the private Reflection, add and remove a Memory, and prepare a private Keepsake.
8. Use **Back to Your Voyages** rather than browser Back.

Expected: remembrance mutations provide visible pending/success/failure feedback and do not rewrite historical facts. Shared artifact context is never presented as personally owned without a personal Wayfarer record.

## Walkthrough E: unavailable, partial, privacy, and responsive behavior

1. Open the supplied record with unavailable or partial supplementary history.
2. Confirm useful accepted history remains visible with calm guidance.
3. Sign out and attempt to return to the record; confirm canonical sign-in is required.
4. Sign in as the supplied foreign synthetic account and use the same record path; confirm the response is a neutral not-found state with no owner title or Memory disclosure.
5. Repeat Archive and Detail at desktop, 430x932 mobile, and 200% effective zoom.
6. Use keyboard-only navigation through filters, cards, detail section links, and remembrance actions.
7. Enable reduced motion and confirm the final semantic state remains immediately usable.

Expected: no horizontal scrolling, trapped focus, pointer-only action, foreign-owner disclosure, raw source payload, storage key, or current-profile substitution is visible.

## Owner decision

Record exactly one decision after completing the walkthrough:

- `OWNER_ACCEPTED_PHASE_1`;
- `OWNER_RETURNED_WITH_ACTIONABLE_FINDINGS` plus exact steps and expected/observed behavior;
- `OWNER_WALKTHROUGH_BLOCKED` plus the exact runtime or environment blocker.

Do not interpret silence, partial review, automated receipts, or a successful retained-runtime launch as acceptance. Do not begin Phase 2 from this document.
