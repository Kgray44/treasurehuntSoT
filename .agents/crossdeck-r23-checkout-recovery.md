---
title: Crossdeck R23 exact-authority checkout recovery
audience: automation
status: approved-in-progress
canonical_for: crossdeck-r23-checkout-recovery
last_reviewed: 2026-10-20
---

# Bounded maintenance contract

Profile: infrastructure; continuation of existing Sounding Line maintenance.
Base `bfea71aad2c7fafdec0590ba1ac09ee3399e08d5`; frozen #721 input
`4b2ba61983faf29a3b6f41e24509f2aae023be6f`, tree
`9c61e98c14ed12b0d9f1266448ffe7fdcbcf82d1`, exact parents previous frozen
`58436ab51dcf8696609fe4a172b8aed2eca33efc` and accepted base. Product,
contracts and E2E source remain frozen.

KG explicitly authorized the exact-base/one-replacement proposal in human
message `Sentinel_77807bdc0154819198f5df631517ab14` at
`2026-10-20T23:15:33Z`. Parent `01a13dd0-e3e1-7409-ab2a-b078e08ff0e1`
verified and relayed it; native human-body reread is not claimed. The existing
#721 owner confirmed the main/reconciliation and consumer-stage hold before
maintenance moves main. No new chat or consumer dispatch belongs to maintenance.

Correct only preparation checkout: fetch the exact authority commit at depth 1,
retain full candidate history at depth 0, keep credentials unpersisted, and give
each preparation checkout an enforced ten-minute step deadline and explicit Git
progress. Distinct authority/candidate/evidence step names expose provider start,
progress and completion timestamps. This is a hard checkout deadline, not an
inactivity detector or a browser-suite cap; the preparation job remains 40 minutes.
The existing consumer owner/coordinator checks checkout progress at intervals
of at most 60 seconds and records actual timestamps. A no-progress checkout must
stop by its ten-minute deadline; no silent extension, fallback fetch or rerun.

Preserve cancelled run `39489881363/1`, original prepare
`788863ffb87643f3f095700161c2e2eadc2983f0`, 42,297-byte payload SHA256
`c639549d679a99d7ee64336c08608037d72133448acf1e5c11d647d8a039f14b`,
and 9,539-byte preparation log SHA256
`a7064d7291e4e782fd789ac6e3c74370bbf011e343dadd0a3e8e74dfc8489240`.
Custody succeeded; authority checkout stalled until the old 40-minute job timeout;
dependencies, browser, uploads were skipped and artifacts 0. Transfer cause is
unknown. Removing unnecessary authority-history transfer is not proof of that
unknown cause's repair.

Preserve 22 prior rows, seven reconciliations, 1,360 pins, expiry
`2026-10-22T23:59:59Z`, all old failures and every gate. Preparation 26 is spent;
completed preparations 26/next 27. Completed reviews 11, still-unperformed
review 12, iteration 16. Exactly one replacement capture and remaining
review/submission/ordinary/technical/replay sequence; no reset, refund, retry,
compatibility bridge or extra paid call. The complete actual-byte pre-source
PASS/stage/native-disclosure protocol and all report/seal/attestation bindings,
functional B1/editorial split and full B2 stay required.

Proof: exact workflow boundaries, source-only shallow-authority/full-candidate
reader fixture, fixed failed predecessor/empty artifacts/absent later slots,
current R23 gate/report/seal/attestation denials and old-generation regressions.
Freeze exact source, independently review it, run one normal protected Ubuntu
qualification/Mainline Decision, perform strict matched-head merge, equal-tree
landed smoke, then hand accepted source to existing #721 owner
`01a14744-5390-77a1-8532-5c32db6980eb`. Maintenance never claims consumer,
Parallax, Refit-owner or physical acceptance. Keep C: above 30 GB; D: originals
and unrelated work remain untouched.
