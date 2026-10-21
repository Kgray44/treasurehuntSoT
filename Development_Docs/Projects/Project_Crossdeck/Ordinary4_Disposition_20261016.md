---
title: Crossdeck consumed ordinary4 replay entry failure
audience: engineering
status: failed-qualification-consumed-cause-under-diagnosis
canonical_for: crossdeck-ordinary4-failure-20261016
last_reviewed: 2026-10-16
---

# Consumed ordinary4 after technical verification

Whole protected [run 38968131415](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38968131415) failed on attempt one in 1762 seconds. Custody passed; focused verification and Mainline Decision failed; preparation skipped. [PR #721](https://github.com/Kgray44/treasurehuntSoT/pull/721) is draft, unqualified and unmerged. R10 reservation `e414624dd6b3901b360729ae024cd181fd42396f` remains consumed with immutable payload digest `147f76e9447c1812a2998caa4d1a4a9186af60baabf5964571640b78ce8ade48`; a fresh GET-only observation confirms qualified is absent. This record authorizes no reset, refund, R10 replay or merge.

| Binding          | Actual value                                                       |
| ---------------- | ------------------------------------------------------------------ |
| Failed candidate | `c9dc54c16bccc93f26bebfb531f1c2471b9fc4d4`                         |
| Failed tree      | `1df0408c983b95f9fe7ee5e23b3a46c23cf2acd7`                         |
| Accepted base    | `b7935ad2f68a278ef49f0618ec3b72263b0fb8b9`                         |
| Source           | `6f065402d448c4330a2f70f4048551de9fc89c37e0c95eae70bcb7553f269b10` |
| Contracts        | `33b7621269fa18417c20713ccc185783861ef043e38a527f727df7e1047c7274` |
| R10 record       | `5c5bd94f499b0eef58d30bef254e7ea8a5a4933d6b6c294b70884510494b28d0` |
| Bridge           | `0142e1726429196b3fb3c000970d4dc9a98f82a92c32a6b29bcd5bb3e9e0888f` |

The [preservation index](evidence/ordinary4-failed-20261016/preservation-index.json) binds seven unchanged original outputs and observations, including the complete hosted log and original decision ZIP. Artifact `12076937018` is 120912 bytes with server/archive digest `sha256:1e5a1d2099eee71f9a1714296097b352379340be6202ce9ac05fddd532c2024c`. Author-created source observations and normalized GET responses are explicitly classified; they are not raw HTTP.

## What the failed run actually proved

The hosted technical Chromium suite reported **38 passed (8.2m)** at21:42:59 UTC, with owned browser cleanup PASS. Later ordinary verification output includes passing format checking, production build route output and Prisma generation completed at21:43:54 UTC. The decision's historical Product Experience projection is PASS. These are outcomes within a failed whole run; they do not establish current replay acceptance or a qualified product.

The current replay result is absent. Final browser qualification is null and timing commands is empty. In protected ordinary.mjs, reconciled verification returns before the historical Product Experience decision is assigned; current replay is awaited next; only after replay returns are verification timings and reconciliation copied into the decision. Thus commands[] does not mean no commands executed, and null final browser qualification does not erase the earlier technical log. The last labelled Prisma command is an ordinary verification command, not evidence that a replay child began.

The thrown failure is bounded to entry or execution of runTrustedExperienceReplay after reconciled verification. The generic sanitized error is `SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED`; the original hosted log does not expose an exact underlying cause. Replay-child execution, SQLite failure, disk exhaustion and a product journey defect are **unproven**. The existing authorized Sounding Line owner is diagnosing this boundary with inert or GET-only source checks that cannot run the application or consume another invocation. Any later exact diagnosis must preserve these originals and distinguish observation from inference.

## Proper continuation and unchanged experience

This failure publication changes human status and evidence only. Product trees, contracts, technical specifications, executable policy, configuration, original media and canonical R8 review remain unchanged. All earlier consumed failures and three private local markers remain intact. Original preparation18, independent review7 accepting seven contracts/119 judgments, authenticated submission3 and four seals retain their original151/source6d/R8 identities. Incomplete R6 aggregates remain null.

Standing owner completion authorization covers diagnosed corrections and properly reviewed/protected finite continuation. It does not permit self-installing a grant or replaying R10. After exact diagnosis, the same authority owner must provide the bounded correction and a separately reviewed, protected, landed successor. No new capture, independent product review, submission, local product proof, product repair or provider call is granted here. The original expiry remains2026-10-22T23:59:59Z.

The eventual final candidate still requires actual default-loader source admission, complete canonical obligations/inventory and live-history custody checks; then all six fresh technical suites,38 current Experience contexts, canonical finalizer, actual exact-source qualified seal and WHOLE workflow/Mainline PASS. Strict matched-head normal merge, landed-tree equality and bounded noncapturing actual-product smoke follow. Owner, physical/native, provider, field and assistive-technology acceptance remain separate.
