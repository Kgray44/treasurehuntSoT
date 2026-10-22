---
title: Crossdeck R13 focused technical proof review
audience: engineering
status: reviewed-supporting-evidence
canonical_for: crossdeck-r13-focused-technical-proof-review-20261017
last_reviewed: 2026-10-17
---

# Crossdeck R13 focused technical proof review

The two completed local focused proofs are valid supporting technical evidence.
Current ordinary qualification remains required; this review claims no Product
Experience campaign, physical-device or owner acceptance.

Accepted authority is `24fb189a90435ccb6021b63fd6953603ae090bc0` (B3).
The corrected execution candidate is `3037e3f6c2ae517e160cf5982f8a03b87672bdf3`
(D1), with source digest
`a63073cbf3850900c91a25979467bb68f3930812e23af3f6daab00b21ab5d17a`.

- [Original receipt](focused-technical/original/receipt.json):
  **FAIL / ORIGINAL_CASE_FAILED**, one case, cleanup PASS. The 15-second Receive
  Living click at `tests/e2e/crossdeck-phase2.spec.ts:218` reproduced interception
  by the open Journal drawer and Return header. Its
  [browser report](focused-technical/original/browser-report.json) preserves the
  error. The screenshot was not reached; media count is zero. Receipt SHA256:
  `7340f930b835c57cc0788decb04bba35b2288c28ed476af291b29e9d1107746a`.
- [Corrected receipt](focused-technical/corrected/receipt.json):
  **PASS / CORRECTION_PASS**, one case, cleanup PASS and both Device Lab assertions
  PASS. Receipt SHA256:
  `49f0b6f0540de8fc5ee5d7fcde6dc58c027f67b95ca2d8d8d0aa2e683bcd4022`.
  The independently inspected [technical PNG](focused-technical/corrected/screenshot.png)
  is 1280 by 2349 pixels; SHA256:
  `cb9278eeaea5bcd83a9dbba8f1f8ee1abc0a1bed4ac61c6216e70fc75c0142d3`.

The [original readiness chain](focused-technical/original/dependency-readiness/readiness-index.json)
preserves attempt1 UNKNOWN, receipt
`3af4cdab910710fe31dae54de5d96a5cbc5f1b041cf06986f5664cf1a805f53b`,
followed by attempt2 PASS, receipt
`83b32eab0a8db865b1436751576e5e853944d7a2fbfadd956a25be0acc9340ee`.
The [corrected readiness chain](focused-technical/corrected/dependency-readiness/readiness-index.json)
preserves attempt1 PASS, receipt
`c3a70ab29e2f43ad1f89552f9637c86b01d7f6786bf50ee5a1e93e69104b5a9a`.
No allowance was refunded. Each case used one worker, zero retries and one
repetition, with zero product captures, product reviews or provider calls.

The reviewed producer evidence comprises 50 files and 20,086,885 bytes; both
[preservation indices](focused-technical/original/preservation-index.json)
[remain canonical](focused-technical/corrected/preservation-index.json).
The reviewed application and corrected test source stay unchanged from D1.
All 13 records and six bridges retain the exact B3/D1 registry blob
`5f32ad400adb401b59f89d6450705abf52b81c79`. Formatter blob
`7299ff76331d5d1273543df449a3700f36a53ace` preserves exactly four F13 original
paths and 68 fixed R13 producer JSON paths, without a wildcard or directory
exemption. Producer bytes, indices and the spent failure remain unchanged.

Independent retained receipt identities are:

- `r13-c5-original-case1-20261017.independent-audit.json`, SHA256
  `82548cd0b8073ba2fc8fb21a465005b0e3144bca89d7bf8f0e4bd21f30b05a8a`.
- `r13-c5-corrected-case1-and-both-proofs-20261017.independent-audit.json`, SHA256
  `f24b678e445a1deabac3daabd4a1100293fc72cecc4ae2b0d2323ce4e8e203c2`.
