---
title: Expired R26 unrelated classification repair
audience: engineering
status: implementation-candidate
canonical_for: sounding-line-expired-r26-unrelated-classification-20261022
last_reviewed: 2026-10-22
---

# Expired R26 unrelated classification repair

The installed R26 owner execution deadline is `2026-10-22T03:59:59Z`.
Original #741 run `39719820417/1` failed in custody at 04:05:13 UTC;
#781 run `39718141177/1` failed in classification at 04:05:21 UTC.
Both original decoded provider logs show
`PRODUCT_EXPERIENCE_EXCEPTION_R26_RECORD_OR_EXPIRY_CHANGED`.
These failed attempts remain failed.

The registry and the three R26 admission modules have identical Git blobs on
accepted main `8e49351e62e1f32340109566557a824bfa74e14d`, accepted retention
main `408f37389e6dd358b1ab005d91f3f588405f61db` and the reader candidate.
The unchanged validator accepts the fixed deadline exactly and rejects one
millisecond later. The record's separate historical expiry at 23:59:59 UTC
does not extend the owner deadline.

## Cause and correction

Both the custody CLI and the planner bind call the live trusted registry reader
before determining whether the candidate belongs to the campaign. Thus an expired
R26 execution grant also blocks unrelated work.

The correction adds a private classification adapter for installed R26 only.
It first validates the complete immutable registry and all predecessor identities
at the fixed historical deadline. It then applies every existing campaign signal
to the original campaign and every registry row. Only a fully validated unrelated
lookup returns no records. A recognized campaign continues through the original
wall-clock trusted reader and every downstream live gate.

The adapter exposes no clock override, record, binding, slot, qualifier or execution
allowance. It does not catch an expiry exception, discard a malformed registry,
reactivate predecessors, change the R26 module, or edit any registry, deadline,
counter, history, workflow or protected branch setting. Other trusted-reader
callers retain their original behavior.

## Focused proof and installation boundary

A fixed-clock same-source unrelated lookup reproduces the original failure in
2.3 seconds. With only the routing correction, three targeted cases pass:
unrelated binding and both custody operations return no campaign; recognized
R26 work still fails expiry without writing output or refs; five malformed-record
variants fail closed for binding, reserve and seal. Every case checks unchanged
Git refs and registry bytes. The source test fixes both parent and child clocks,
and bounds Git calls, child processes and the outer runner.

The unchanged accepted R26 suite also reproduced five historical valid-fixture
failures after the deadline, and its retained finalizer case reproduced a sixth.
Only these R26 test cases now use the original authorized fixture clock. Their
assertions, malformed-record mutations, live before-floor/after-deadline checks
and explicit expired-reader rejection remain intact. The clock wrapper is local
to the R26 module; it does not freeze other importing modules. The finalizer clock
is limited to its R26 case. No production validator or deadline changes.

An earlier changed-source local fixture exceeded its intended budget before
reporting a result. Its incomplete receipt and original fixture remain retained;
it supplies no passing or causal proof. The smaller same-source reproduction
does not claim complete changed-source integration coverage.

Independent exact-source review, Linux qualification and actual protected
installation remain required. Normal ordinary custody on the current installed
base still fails before it can execute this correction. The existing installed
control-plane workflow is a potential bootstrap route, but its exact workflow
bytes, owner scope, candidate check head, required app/context, current-main
ancestry and narrower coverage must be resolved before dispatch. A matching job
name alone does not establish eligibility. No failed ordinary run is being
started as a bootstrap experiment.

The composed reader PR #788 remains draft pending accepted infrastructure and
fresh qualification. This repair supplies no consumer capture, review, replay,
retry or replacement R26 authority.

Feature Catalog disposition: ordinary infrastructure correction; no major
capability or important subfeature change.
