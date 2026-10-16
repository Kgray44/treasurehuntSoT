---
title: Crossdeck R5 bounded custody transport recovery
audience: engineering-owner
status: approved-pending-protected-installation
canonical_for: crossdeck-r5-transport-recovery-20261015
last_reviewed: 2026-10-15
---

# Failure and bounded correction

[Ordinary run 38822426167](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38822426167),
attempt1, failed on protected base `a2495fd14efd5ade67832e18fd260f32da98b3b2`
for #721 head `87bb29391ee747d9738cc7f259c47f4343a7da89`. Custody job
`116721903368` reached reservation step6, which reported only `fetch failed`.
The available log does not identify the endpoint, network cause, or whether the
failed request was a read or write. Technical verification and experience preparation
were skipped; Mainline Decision failed. No qualification seal or artifact exists.
The ordinary dispatch remains consumed despite the absent `qualify` ref.
Preserved [original log](evidence/crossdeck-r5-transport-20261015/ordinary-38822426167.original.log)
and [job boundary](evidence/crossdeck-r5-transport-20261015/failed-ordinary-boundary.json)
retain this failure. It is separate from the previously corrected capture lifecycle.

`custody-transport.mjs` gives each request a 20-second deadline covering fetch and
response-body decoding. A GET may make at most two total attempts, with 250ms
backoff, and the request client shares a maximum of two additional GET attempts
across its whole custody invocation. Only network/body failures and HTTP
408/500/502/503/504 recover. Missing refs (404) retain their existing meaning;
authentication, permission, rate-limit and other HTTP failures remain terminal.
Every attempt clears its deadline and aborts remaining response resources.
The custody CLI forwards the same client into nested exception attestation, so
that path cannot reset the invocation's retry budget. Archive loading retains its
existing binary/provenance interface and does not receive this JSON-only client.
Diagnostics identify method, query-free endpoint, attempt, outcome and safe error
code; they omit credentials, headers, bodies and raw error messages.

All writes remain single-attempt. An unknown write result fails closed and cannot
trigger automatic create/ref retry, update, deletion or refund. A create conflict
still means consumed custody. These transport attempts occur inside one existing
logical invocation and do not create another capture, review or qualification.
The existing 15-minute custody job limit and protected permissions remain intact.

# Approval provenance and finite successor

Native #721 user message `01a1423b-99f3-7250-9972-c5c27b1e1545`, in chat
`01a12d5e-eb9a-7a72-aecb-adfa3c59a89a`, says exactly:

> You are owner authorized for ANOTHER fucking retry

It followed the custody-fetch failure notice in turn
`01a14169-2670-78f1-aadb-b006cc307a37`. No immediately preceding question
explicitly enumerated preparation16/review6. The native reader exposed no separate
user-message timestamp; the earlier turn start is not an approval timestamp.

Coordinator chat `01a13dd0-e3e1-7409-ab2a-b078e08ff0e1`, turn
`01a14247-2da6-748a-8c99-8e0005f005b2`, relays the parent's contextual disposition
from `01a0f4a3-e2a2-7591-a1c3-167849b860cf`: proceed with necessary gate-preserving
recovery already explained to KG, independently protect the narrow transport
correction, then exactly one fresh capture16/review6/authenticated submission/ordinary,
protected merge and landed verification if PASS. This is a contextual scope relay;
it is not presented as a verbatim numbered native approval. The record preserves
both sources and uses `executionNotBeforeUtc` as a conservative execution boundary,
with the unexposed approval timestamp explicitly null.

`PE-X-CROSSDECK-FINAL-VERIFY-20261015-R5` is a pinned version5 successor in the
existing exception registry. Original/R2/R3/R4 objects remain byte-equivalent and
cannot reactivate when R5 retires. R5 freezes accepted product/configuration,
contracts, technical tests and all 60 R4 evidence files at #721 head `87bb293...`;
the prior 68 immutable history entries remain. Installed protected infrastructure
is inherited through the existing binding rules. No product or contract repair,
additional local proof, paid provider call, refund, rerun, review7 or expiry
extension is admitted. Expiry remains **2026-10-22T23:59:59Z**.

Before any new reservation, the validator checks the original/R2/R3 predecessor
chain and exact cancelled authentication, then all four immutable
[R4 custody packets](evidence/crossdeck-r5-transport-20261015/r4-custody.original.json),
successful capture `38814444774`, authenticated review `38820570426`, their three
artifact identities/digests/sizes, both source trees, and failed ordinary
`38822426167` with its exact skipped-verification boundary and zero artifacts.
The seven exact historical runs are recognized from the original **13:54Z** epoch.
Any altered/missing history, unrecognized execution, failure, cancellation,
incomplete pagination, or ambiguous write still stops execution.

History remains fifteen full preparation/repair attempts, five completed independent
reviews, one bounded product repair, one local parent/two child replays, two
authenticated dispatches (one cancelled), and one failed ordinary dispatch. The
new limits are preparation16, review6, authenticated dispatch3 and ordinary
dispatch2, one each. Prior unused ordinary slots are never borrowed. Accepted
review FIVE retains its verdict and findings; it does not qualify a new base.
Unchanged attestation requires fresh capture and review bound to the newly
installed base/source/contract/exception.

# Integration and evidence boundary

Independent exact-source authority review and protected ordinary qualification
must precede installation. Candidate authority cannot approve itself. The actual
Linux ordinary workflow must pass before protected merge, followed by a bounded
noncapturing landed smoke. The read-only checkout probe recognizes installed R4
or R5 with exact reference/tree checks and still refuses consumer reservations.

Focused regressions cover transport recovery/exhaustion/deadlines, invocation-wide
budget, sanitized diagnostics, single-attempt ambiguous writes, exact sealed history,
record mutation/retirement, failure-boundary tampering, missing runs, review ordinal,
old evidence rejection and real Git product/test/contract/history binding. Hosted
and accepted-main results belong in the exact-source handoff after they complete.
Local tests alone do not establish protected acceptance.

Initial independent authority review of `d8a5c895fef2ba2dca7eb19ce2264cabd2171655`
found that nested attestation created a second request client. That review is
BLOCKED and remains historical; the correction shares the original client and a
regression consumes retries before and inside nested attestation, proving a third
transient read fails without retry. Fresh exact-source review is required.

KG's disk hold remains operational: no new consumer capture until storage is stable;
C: below 30GB is treated as full. This maintenance uses an independent D: Git object
store and D: dependencies/cache/temp/output. Shared C: repositories and active
owners are preserved. SC-00A's separately approved authority remains isolated until
Crossdeck closes. This infrastructure candidate changes no completed catalog capability.
