---
title: Crossdeck R23 authority checkout recovery disposition
audience: engineering
status: approved-pending-protected-installation
canonical_for: crossdeck-r23-checkout-recovery-disposition
last_reviewed: 2026-10-20
---

# Observed failure

Run `39489881363/1` is cancelled. Its custody job `118859922789` succeeded,
reserving preparation 26 and still-unperformed review 12 at original commit
`788863ffb87643f3f095700161c2e2eadc2983f0`. The 42,297-byte original payload
SHA256 is `c639549d679a99d7ee64336c08608037d72133448acf1e5c11d647d8a039f14b`;
it still records completed reviews 11/reserved12 and is never rewritten.

Preparation job `118863377085` entered authority checkout at
`2026-10-20T20:18:44Z`, ref
`bfea71aad2c7fafdec0590ba1ac09ee3399e08d5`, fetch-depth 0. The last transfer
command requested all branches and tags. There was no later transfer progress
before cancellation at `20:58:45Z`, at the 40-minute job limit. Dependencies,
browser execution and uploads were skipped. Complete provider artifact listing
has total_count 0 and an empty array. There is no current capture, first pass,
authenticated review or success seal. The 9,539-byte original preparation log
SHA256 is `a7064d7291e4e782fd789ac6e3c74370bbf011e343dadd0a3e8e74dfc8489240`.
Original bytes are retained privately and matched the owner's independent readback.

The network/transfer stall's underlying cause is UNKNOWN. Evidence establishes
an unnecessarily broad authority-history fetch and a missing shorter checkout
bound; it does not establish a provider, network or Git defect.

# Authorized correction

Human message `Sentinel_77807bdc0154819198f5df631517ab14` at
`2026-10-20T23:15:33Z` explicitly approved the exact-base authority checkout,
full candidate history and all ancestry/evidence checks, independent protected
installation, and exactly one replacement capture with the still-unperformed
media-first review and remaining #721 closure. This is a parent-verified human
relay, not a claimed native human-body reread.

The authority checkout now requests only exact inputs.base_sha at fetch-depth 1,
with fetch-tags false. Candidate fetch-depth 0 remains unchanged. Evidence
checkout remains at its previous depth 1 and condition. Each preparation checkout
has a distinct name, explicit progress and a step-level timeout-minutes 10.
The hard per-checkout deadline bounds a silent stall without relying on the
model to cancel it. It is not an inactivity-specific detector. The 40-minute
preparation job and browser budgets, credentials, provisioning, capture,
publication, authority and attestation remain otherwise unchanged.

Provider step metadata and Git progress expose actual start/progress/completion
timestamps. During the authorized replacement, the existing owner/coordinator
checks at least once per minute and retains those observations. A checkout that
stops at the deadline remains a spent failure; there is no fallback/refund/retry.
Source-only tests exercise the real preparation import/installed snapshot reader
with shallow authority and a candidate whose ancestry and tags remain complete.
This is development proof, separate from actual future hosted preparation.

# Finite successor

The [historical ledger](historical-ledger.json) retains 22 prior rows, seven
reconciliations, 1,360 immutable pins and all 25 historical runs. Preparation 26
remains consumed: completed 26/next 27. Reviews remain completed 11/remaining 12;
cumulative iteration 16. Expiry remains `2026-10-22T23:59:59Z`. Each remaining
capture/review/ordinary/technical/replay has one slot, with zero resets, refunds,
retries or extra paid calls. All R22 first-pass fields, actual-byte gating,
native freshness/exposure requirements and PASS/stage/disclosure binding through
report/seal/attestation remain mandatory. Functional B1/editorial split and full
B2 remain required. No product, contract or E2E fixture change is authorized.

Exact-source independent review and normal protected Ubuntu/Mainline Decision
precede strict matched-head merge and equal-tree landed checks. Only the existing
#721 owner then controls the one authorized replacement and remaining closure.
Maintenance creates no consumer reservation or dispatch. A passing maintenance
run is not actual preparation/capture proof or product/physical acceptance.
