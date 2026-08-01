---
title: Project Sounding Line Performance Budget Report
audience: engineering
status: current
last_reviewed: 2026-07-31
---

# Project Sounding Line Performance Budget Report

## Complete governed browser evidence — 2026-07-31

Hosted release-candidate run `30691520484` produced `RELEASE_GO` from 42
unique clean receipts. All 16 browser families remained within their current
hard budgets: 325 cases were registered, discovered, executed, and passed;
zero failed or skipped. The slowest measured browser worker was accessibility
at 2,112,548 ms against a 6,300,000 ms hard budget, followed by animation
lifecycle at 1,629,531 ms against 2,160,000 ms. The finalization evidence
digest is `b77651d013d5d6386bf9307887dd736525fd272824d9d4a58a0bc8e6d1e88fbd`.

The complete per-family durations, declared budgets, isolation, evidence
artifacts, and receipt digests are retained in
`Project_Sounding_Line_Final_Browser_Closure_Ledger.csv`. These are governed
cold-path receipts; no automatic retry was used and no timeout was raised.

## Historical budget reviews

The authoritative mainline receipt dated 2026-07-30 completed 27 required
families with `RELEASE_GO`. Every receipt recorded a clean cleanup state and
no timeout. Notable elapsed times were static core 56,876 ms, the isolated
access sentinel 119,890 ms, production build 73,897 ms, player-shell component
45,505 ms, and private-content unit 15,099 ms.

Hard budgets are enforced by the governed adapter timeout, not merely reported.
The static family budget was raised from an unverified 60 seconds to an
empirical 120 seconds after its observed cold validation. The access sentinel
has a 600-second hard budget to include fresh isolated-runtime creation; its
test command itself remains a three-test fast sentinel. Broad browser matrices
are not represented as mainline performance passes.

The source of truth is
`artifacts/sounding-line/mainline-authoritative-final.json`, plan digest
`ea07b1f3b4ffb8fec0d40d168bf5da60091a362368bc371563f4826b96bee91e`, and
final evidence digest
`a68bf1c7d135af6ae35959f0c96f90dd77e5a72a65fca24615c039f33fc74682`.

## Serial accessibility browser-family budget review — 2026-07-31

Owner: `lanternwake`. Review date: `2026-08-07` (or immediately after the
first complete governed receipt). This is a measured correction to a serial
two-project family, not an authorization to parallelize it. The attempted
parallel run `30610144261` exposed shared journal-readiness contention and is
retained as failed evidence; `parallelSafe` remains `false`.

The serial governed run `30609493591` exhausted its former inner 420,000 ms
Playwright deadline after 61 Chromium cases. Its corrected 30-minute run
`30610819644` reached Chromium plus 28 WebKit cases before the governed
1,800,000 ms hard budget expired (`exitCode 124`, elapsed `1,800,234 ms`).
Those receipts establish that the former budget cannot represent the required
two-browser serial proof. The new expected duration is 5,400,000 ms and hard
budget is 6,300,000 ms, with a 120-minute hosted-job envelope. The runtime
derives Playwright's global deadline from each selected suite hard budget and
reserves 120,000 ms for server teardown, isolation verification, and receipt
emission; the adapter hard budget remains authoritative.

The runtime deliberately creates a fresh disposable dependency and database
root for every governed browser run, so a conventional warm-cache measurement
would not exercise the governed path. The first complete receipt under this
budget is the required cold-path confirmation; no retry is being treated as
evidence. The review must inspect setup, test, cleanup, and artifact-upload
timings before retaining or revising the budget.

## Animation lifecycle browser-family budget review — 2026-07-31

Owner: `lanternwake`. Review date: `2026-08-07`. Focused receipts
`30615341155` and `30616032473` recorded clean teardown but reached only 24
and 27 of 39 Chromium cases before the former 600,000 ms adapter deadline.
The second run passed the previously failing Rive and Quartermaster assertions
and then hit the adapter deadline at 583,312 ms; it was not a product failure
or a retry pass. The family therefore receives a 900,000 ms expected duration
and a 1,200,000 ms hard budget. The selection remains serial, exact, and
cleanup-reserved through the suite-derived Playwright deadline. The next
complete focused receipt is required cold-path confirmation. The first
corrected budget still reached 33 passing cases at 18 minutes before its
1,200,000 ms boundary, leaving six long audio/lifecycle cases. The measured
serial envelope is therefore revised to 1,800,000 ms expected and 2,160,000
ms hard, preserving the same two-minute cleanup reserve. This is the final
budgeted focused proof before the complete release-candidate run.
