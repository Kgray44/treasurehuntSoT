---
title: Crossdeck R24 ordinary checkout recovery disposition
audience: engineering
status: current
canonical_for: crossdeck-r24-ordinary-recovery-disposition
last_reviewed: 2026-10-21
---

# Ordinary checkout and retained review recovery

Run 39553886766/1 remains cancelled and consumed. Its custody candidate checkout
started at 06:11:57Z on 2026-10-21. The last observed command fetched all remote
branches and tags; no later transfer progress appeared. The owner requested
cancellation at 06:21:58.134Z. This was an owner-enforced ten-minute cutoff;
the custody step did not have that configured deadline. The underlying transfer
cause remains unknown. The custody job was cancelled, Mainline Decision failed,
and focused verification and preparation were cancelled. No artifact or qualify
reservation exists. Historical outcomes and counters remain unchanged.

R24 proposes complete nonshallow commit/tree ancestry for exact candidate/base
and seven historical preparation/custody roots. An initial unfiltered local probe
failed its enforced deadline after 595342ms; all owned cleanup passed. Its final
captured progress was 5.42GiB/63%, but a later large-output regression found that
unpipe can leave the new helper's streams paused. Thus output backpressure cannot
be excluded from that diagnostic; it does not establish the production transport
cause or a sustained throughput limit. The failed bytes/receipt remain preserved.

The revised transport fetches commits/trees with blob:none and explicitly hydrates
every blob of every protected referenced historical snapshot plus current base and
candidate. It uses no filename or size heuristic. This is an explicitly partial
blob store: only unreferenced historical blobs may remain absent. Every required
object/type, current working byte and full commit/tree ancestry must be verified.
All 1360 historical reference pins retain exact modes/blobs. The candidate retains
1359 unchanged pins; only candidate-review.json must match the exact accepted R23
publication blob 0254bb18f0a4af9593423f1ddbdac7138f58c801 in mode 100644. Its older
7131e22305cac75317ab1d6f48a9ed807f8da9bc blob remains required locally. Every other
change, deletion or mode mismatch fails. Promisor routing is removed and later Git transport is forbidden
before validation; missing required reads fail immediately. No sparse checkout,
wildcard fallback, implicit lazy fetch or retry exists. Git path/config injection
is removed from the child environment. Pipes are explicitly resumed and fully
drained before returned output is parsed. Full cleanup PASS remains mandatory.

The helper pins origin/main to the requested protected base and checks exact HEAD.
One 600-second deadline includes graph fetch, explicit hydration, checkout,
verification and cleanup reserve. All four consumer paths use it; authority
checkouts use bounded depth-one transfers. Write jobs first compare the requested
base to the trusted workflow SHA and select authority only from github.sha.
This removes broad transfer and unbounded waiting boundaries, but readiness still
requires a successful measured source-bound transport and Linux qualification.


Successful R23 capture 39520615298/1 and authenticated review 39551039268/1 retain
their exact original source e6cf2d544efc36fce2ccfee7f16334296a1f82e783726e7dfd067a67d3a7debf,
base e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab, contract and record identities.
The installed bridge authenticates those identities, all original media/report,
pre-source PASS/stage/provenance and four read-only custody slots. Every frozen
product, contract, dependency/configuration, evidence/media and producer path
outside the reviewed maintenance overlay must remain byte-identical. Normalizing
only that declared overlay must reproduce the original digest. The actual current
source digest is separately computed and required by current ordinary replay,
observation, all eight obligation groups and qualification. No evidence header
is relabelled. The seven pre-source validator files stay unchanged.

R24 authorizes capture 0, review 0, ordinary 1, technical 1 and replay 1. Verify,
source staging, old qualification fallback, reruns and refunds are forbidden.
Completed preparations are 27, completed independent reviews 12; retained review
ordinal 12 and iteration 16 identify original evidence. The inherited next
preparation label 28 is unused and grants no capture entitlement. The 28 complete
historical run identities, 23 prior rows, seven reconciliations, 1360 pins and
2026-10-22T23:59:59Z expiry remain fixed. No paid provider calls are granted.

This record describes a proposed maintenance installation. Independent review,
normal protected Linux qualification, strict matched-head merge and landed smoke
remain required. Consumer publication and execution belong to the existing #721
owner after exact handoff. This maintenance does not claim Crossdeck, Parallax,
Refit-owner, native AR or physical acceptance.
