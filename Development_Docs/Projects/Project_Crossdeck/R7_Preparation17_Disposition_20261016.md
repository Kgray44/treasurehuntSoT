---
title: Crossdeck consumed preparation17 and restored Chart readiness
audience: engineering
status: diagnosed-consumed-preparation
canonical_for: crossdeck-r7-preparation17-disposition-20261016
last_reviewed: 2026-10-16
---

# Consumed protected preparation17

[Run38880737676](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38880737676)
failed on protected base `ce862a4a349b92faa11beaef50555abcb1a35be8`, candidate
`0dd0847458dedaab3b5b1d0f5b4b73fe78aaa087`, tree
`bb030c5a449081d51cf2e5d7cfe692c7288b541e`, source digest
`91769eb493df857300b454939e1e2004338e10b12991b8651a18dedc14ba3be0`.
Custody passed; preparation failed in the REDUCED paired case at the final drawer
visibility assertion. NORMAL and adverse recovery passed. The report records
two expected passes, one unexpected failure, zero skips, flaky results or retries,
and duration119,262.54ms. All32 generic `context.result` events preceded that
failure, but no complete capture manifest or full experience acceptance was issued.

The original failure remains `PRODUCT_FAILURE` /
`SOUNDING_LINE_BROWSER_PRODUCT_FAILURE:PLAYWRIGHT_EXITED`. This classification
is preserved independently from the source-backed diagnosis below. The R7 local
proof remains consumed PASS, parent1/child1 and three cases/six contexts. R6 remains
consumed FAIL with its original marker and null aggregate fields. Preparation17
must not be replayed. Independent product review7, authenticated submission3 and
ordinary2 did not start.

## Original artifacts and cleanup

| Original artifact | GitHub ID     | Downloaded and server SHA256                                       |
| ----------------- | ------------- | ------------------------------------------------------------------ |
| Partial capture   | `12037519792` | `2647f25006cea85efd5f127d31dec7e96968a259436c6c15ff6daa12ff4a88ee` |
| Lifecycle upload  | `12038770189` | `7dbd634e95d42b7f6d5257cbc02a4346464e6de0027438de58d5d37488a3b8b7` |

Both exact ZIPs and all extracted bytes are retained in task-owned D storage.
The capture ZIP contains1,636 entries and1,415,910,973 uncompressed bytes, including
preserved earlier evidence. The lifecycle ZIP contains only its original plan;
runtime cleanup is observed in the unchanged full job log. That log's SHA256 is
`fd8f61b8b6d829a637744d91f082df77daad32dcb521f16d4775af8ea83f03bb`.
The [failure index](evidence/r7-failed-preparation17-20261016/failed-preparation-index.json)
binds514 published original files and distinguishes32 byte-identical earlier
recordings that remain preserved in the original archive and executed source.
Raw JSON archival copies retain their exact bytes as original raw text; they are
separate from parsed acceptance metadata.
The independent Windows diagnosis is stored as an original ZIP entry so Git
cannot normalize its CRLF bytes; repository attributes remain unchanged.

Owned cleanup passed in57ms. Browser and server wrappers exited1; the server
payload exited143. Both trees were reaped and streams closed, with no escalation;
the proxy closed and ports were released. A lifecycle hang or zero payload exit
is not claimed.

## Trace-backed diagnosis

The preserved independent read-only diagnosis has SHA256
`fd73b465f2739c7589f9dc5429b3a852b82707b04e479906febf9bed5ad536bf`.
The actual failed phone image and trace are archived with the index.

In REDUCED, the Journal-state response initially had `openDrawer:null`.
The test's `isVisible` guard returned false at76650.846–76677.607ms, so no close
click occurred. Its immediate hidden assertion passed. A later authorized sync
snapshot supplied the mirrored Map, and a journal-state POST at77043.008ms set
`openDrawer:'map'`. Continue then succeeded, advancing the canonical next block
and sequence7. The real Return to Current Objective click changed the page while
retaining the open tool. The final hidden assertion failed; subsequent completion
heading/in-viewport and database assertions did not run in REDUCED.

In NORMAL, the same guard returned true, the real close click ran before Continue,
and the final drawer and progression assertions passed. Journal tools visibility
therefore preceded asynchronous presentation restoration in the failed case.
The trace also records an events429 response; its rate-limit cause is not inferred.

The bounded correction is to wait for the expected restored Map drawer and its
actual populated Chart readiness before closing it and continuing. All actual
Continue/response/Voyage/edition/sequence/next-block checks and final hidden drawer,
visible completion heading, in-viewport and database assertions remain required.
No product, transport or lifecycle change is indicated by this failure.

The prepared static correction now waits for the visible **Charts and locations**
drawer, its **Imaginary Isles** content and **The Living Chart is ready.** status,
then performs the real close before Continue. The final hidden-drawer assertion
remains, so a genuine reopening after that close still fails. The correction has
not been executed; fresh source-bound proof requires the accepted finite successor.

## Continuation boundary

Standing owner authorization covers this diagnosed correction and a separately
reviewed, protected finite successor without another routine owner question.
It does not reset or refund R7 or permit borrowing unused slots. The next grant
requires its exact consumer source freeze, preserved originals and accepted-main
handoff before any new execution. Original expiry remains2026-10-22T23:59:59Z.
PR #721 remains draft and unqualified; product-owner and physical acceptance
remain separate.
