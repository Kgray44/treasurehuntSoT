---
title: Crossdeck R22 pre-source actual-byte admission disposition
audience: engineering
status: approved-pending-protected-installation
canonical_for: crossdeck-r22-pre-source-byte-gate-disposition
last_reviewed: 2026-10-20
---

# Failure and authorized recovery

R21 capture `39453809903/1` succeeded at protected base
`974f78267186ae038736d0addac6359cff5298ea` for candidate
`58436ab51dcf8696609fe4a172b8aed2eca33efc`, tree
`de835afc749264b49d7b995008f6c6f3074f40b1`. Original prepare
`005bbd181872629bb2b5a941fac6ddd43dfa16b7` remains immutable. Its 38,135-byte
payload SHA-256 is `209071bb30fe800cb7cf2fdb6e34415a47e9d7b438402a6e06311e3c639cd519`;
the original says completed reviews10/reserved11 and is never rewritten to11.

Review11's original first pass is 100,173 bytes, SHA-256
`09072285f1bbb1ae09f69860b8127a5670daf2de09107321194f4daf5539d7a3`.
The separate 2,627-byte failure report SHA-256 is
`f522f0a180b4f2b5ce0da5a8e47c3cc3c5fdb791b1ab34077be0983f0bdc0d77`.
Freeze `17:17:46.234556Z` preceded source access `17:24:02.440899Z` on
2026-10-20, but required root fields were absent, capture ID was a string,
critic-selection shape was wrong, all119 dimensions used `mediaIds` instead of
`evidenceIds` (nine empty), and three paired rows used `scenario/devices` instead
of `caseId/contexts`. The raw original is completed, spent, nonqualifying
auxiliary evidence. No second-pass review, authenticated submission or ordinary
attempt exists. Capture success does not repair review provenance.

The custodian checked byte identity, JSON parsing, counts and citations, then
released source through a manual cross-thread handoff. The pinned full validator
needed later canonical judgments; its first-pass predicates were not available
as an enforced pre-source check. The correction extracts those predicates and
uses them both before source release and during final review. It does not
normalize the malformed original or fabricate observations.

KG explicitly approved this recovery in human message
`Sentinel_8393f9239fa88191a49dc59392dca0e2`, replying to
`Sentinel_0642abdcffe48191b336f7a277f38cb2` at `2026-10-20T18:18Z`.
This is a parent-verified direct-human relay; native reread is not claimed.

# Enforced controlled route

The custodian uses the actual frozen file Buffer and expected original byte
length/hash. Shared predicates require fatal UTF-8 decoding, exact root types and
identities, real fresh-critic creation metadata, ordered media/freeze times,
seven contracts with all17 canonical dimensions and substantive observations
with nonempty same-contract `evidenceIds`, plus all three paired cases on both
devices with correct current media bindings. Canonical dimension names come
from one shared source and do not depend on a later judgment file.

The source gate authenticates the current protected capture and successful
original preparation, binding artifact/run/attempt/archive digest, current
base/captured candidate/source/contracts/record tuple and full capture-index
digest. It retains the exact validated first-pass snapshot and a durable,
create-only PASS receipt before reading or staging the critic's source packet.
Validation or receipt-write failure reads no packet. Staging is explicitly
`STAGED_NOT_DISCLOSED`; an unsuccessful/ambiguous native send cannot become
`DELIVERED`. The final envelope requires actual verified native disclosure
metadata and truthful chronology, in addition to the same PASS and stage.

All receipts bind through the immutable review seal, protected report and
authenticated attestation. Attestation rechecks the authenticated capture index,
preparation and pinned validator blobs. This establishes the controlled route's
ordering; it does not prove that a critic never independently browsed source.
Actual fresh-context selection and exposure history remain the owner's duty.
The operations guide specifies the mandatory route and receipt fields.

# Finite successor and acceptance boundary

The [historical ledger](historical-ledger.json) retains all 21 previous records,
seven reconciliations, 1,360 pins and all24 historical runs. Completed
preparations25/next26; completed reviews11/next12; cumulative iteration16.
Original expiry remains `2026-10-22T23:59:59Z`. Capture/review/ordinary/technical/
replay each have one slot; no refunds, resets, retries or extra paid calls.
Review11's exposed critic `01a159fe-37c1-7469-9441-37a5e5c3c0d1` is excluded.
R20's exact functional/editorial split, full B2 resolution and all other gates
remain required. Refit owner acceptance remains outstanding.

This authority source requires independent exact-source review, normal protected
Linux qualification/Mainline Decision, strict merge and equal-tree landed proof.
Only the existing #721 owner subsequently owns the approved fresh capture,
fresh review, authenticated submission and protected consumer closure. No
consumer stage is dispatched by maintenance. #721 merge, Parallax, physical
proof and owner acceptance remain separate.
