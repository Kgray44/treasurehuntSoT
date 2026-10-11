---
title: Crossdeck realtime transport protected integration closure
audience: product-engineering
status: integrated-mainline
canonical_for: crossdeck-realtime-protected-closure-20261011
last_reviewed: 2026-10-11
---

# Protected transport integration

The committed-change transport and crew-display lifecycle correction landed through
[PR #706](https://github.com/Kgray44/treasurehuntSoT/pull/706) at
`e4c5f19e1e5936a059ebaeb17e1179f10490418c`. Normal protected merge used the qualified
head without an administrative bypass. Its tree exactly matches the accepted
candidate tree. The [design and measurements](Realtime_Transport_20261011.md)
retain the earlier frozen measurement boundaries; this receipt closes software
integration rather than rebinding old measurements to new source.

| Binding                   | Exact identity                             |
| ------------------------- | ------------------------------------------ |
| Qualified candidate       | `1b65c50429ff149ba0da90600f62d738b6922cf6` |
| Candidate and landed tree | `e8014786eaa12767c0891641a81f2250a26497d3` |
| Trusted protected base    | `01d32824127d00628546ea4209d09fea57c335c1` |
| Base tree                 | `09701f1389e0444495e56b176f933f60a24d49be` |
| Landed product commit     | `e4c5f19e1e5936a059ebaeb17e1179f10490418c` |
| Required hosted run / job | `38167688576` / `114553564119`             |

## Independent acceptance and retained failures

The required [Sounding Line Mainline Decision](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38167688576)
and [published decision](realtime-integration-evidence-20261011/ordinary-pass-1b65c504.json)
both pass. Artifact inspection verifies all four source bindings above, all
**10/10 obligations** satisfied, and empty remainder and errors. Hosted Vitest
passes **1,236 tests / 213 files**, with registration and mandatory static,
privacy, migration, build and browser obligations passing. The selected browser
run passes both Phase 2 journeys; the metrics-only realtime benchmark explicitly
skips outside its owned measurement runtime. Its separate clean-source measured
run passed and is retained in the design record. No skipped case is counted as
browser proof.

The earlier [passing measurement-head decision](realtime-integration-evidence-20261011/prior-ordinary-pass-2f3e55e6.json)
qualifies only `2f3e55e6`. The [failed corrected-head decision](realtime-integration-evidence-20261011/prior-ordinary-fail-9e3415cd.json)
remains failed: its reverse Receive visibility assertion timed out at ten
seconds. The browser case now requires a successful reverse command response
before checking visibility and allows one ten-second reconciliation interval
plus five seconds of request budget. Metadata-only failure diagnostics retain
device, HTTP method, status and revision. Actual latency measurements are not
changed by this functional timeout. On the reconciled clean source, all four
journeys pass and three additional repetitions pass all six Phase 2 cases.

Concurrent Pilot PR #707 is preserved, including its optional Journal instrument
slot. The only merge conflict was the current-status prose, reconciled against
actual protected main. This correction neither redesigns Studio nor implements
a later spatial phase.

## Exact landed verification

The owned checkout switched to the exact product merge with clean source before
validation. A fresh production build and **four Chromium desktop/phone journeys**
pass. The full focused Crossdeck regression passes **70 tests / 12 files**.
Documentation, private-content and Feature Catalog validation pass. The
[landed runtime](realtime-integration-evidence-20261011/landed-runtime.json)
records the exact merge/tree, unchanged lockfile fingerprint, fresh build and
exit of both task-owned server processes.

All four shared Phase 1/2 Device Lab D0 cases and all four D1 browser cases pass
on the clean landed source. Their new receipts retain the scenario packs'
original base identities and declare zero remaining owned resources; historical
phase receipts are unchanged. [Published screenshots and their checksum mapping](realtime-integration-evidence-20261011/screenshots.json)
match the four landed D1 receipts. Receipt fields are preserved; JSON formatting
is normalized for repository checks.

## Availability and remaining gates

Software integration is closed. Streams provide authorized post-commit hints,
shared-database cross-process revision recovery, bounded reconnect and lifecycle
cleanup, and ten-second active canonical reconciliation. Notifications do not
replace command, snapshot, custody, acknowledgement or One Voyage authority.

The measured idle request reduction is 94.7–95.3%; sampled SQL and CPU improve,
while memory is mixed. Three UI receive prompts measure 102–194 ms after committed
hints; cross-process delivery measures 1.2–2.0 seconds and deliberately dropped
hints recover in about ten seconds. These are source-bound local observations,
not a deployed or physical SLA. Failed simultaneous SQLite startup cohorts remain
explicit limitations. No production soak, real-device/field, native suspension,
deployment, release or owner acceptance is claimed.

The independent [Spatial Studio baseline PR #705](https://github.com/Kgray44/treasurehuntSoT/pull/705)
remains a published draft for owner inspection. Its screenshots establish the
actual captured interface, without visual owner acceptance. Future Studio work
has separate ownership and does not gate this transport's software closure.

This performance/recovery correction preserves the major capability. No owning
Feature Catalog fragment change is required; accepted Pilot catalog work is
preserved. This evidence-only publication changes no qualified product source.
