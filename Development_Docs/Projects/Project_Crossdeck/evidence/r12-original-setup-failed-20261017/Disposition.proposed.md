---
title: Crossdeck R12 consumed original focused setup failure
audience: engineering
status: failed-setup-consumed-nonaccepting
canonical_for: crossdeck-r12-original-setup-failure-20261017
last_reviewed: 2026-10-17
---

# One consumed entry, zero technical cases

The one R12 original focused entry began its reservation at `2026-10-17T02:00:01.208Z` and completed at `2026-10-17T02:00:19.045Z`. Its canonical receipt remains `status: FAIL`, `outcome: EXECUTION_UNKNOWN`, `invocations: 1`, `caseExecutions: 0`, with zero retries, additional repeats, Product Experience captures, reviews and product-provider calls. Owned-process cleanup passed. Original and launch markers remain spent and unchanged. The corrected entry and ordinary6 were not started.

| Binding                  | Exact preserved value                                              |
| ------------------------ | ------------------------------------------------------------------ |
| Installed R12 base       | `e85ceda26a3770dfb2b01f2afd916e45761a5d9e`                         |
| Original source          | `53601e9e386bb4f1062719befc77b7778b9e4430`                         |
| Original tree            | `85e9accc1d273d0f649119380d775df41e6dcf0a`                         |
| Source digest            | `3e69c2306442758edca417fdb478f1a61e009f1cbc82d584bcad6e760257df0f` |
| Contract digest          | `33b7621269fa18417c20713ccc185783861ef043e38a527f727df7e1047c7274` |
| R12 record digest        | `9d140072d1cd31a363bf667380b1298eb1b8a9ef0489eb0be564922f85f5239c` |
| Canonical receipt SHA256 | `521f8d93eb65ddccc8149e4aff8f95e4e7df7590b649d406e345f61df9d9a34d` |
| Original marker SHA256   | `6fdb259876c45b0ea3c9c23ceff177dbb1fa9f00c58b7bf5721bb35ce2e0a803` |
| Launch marker SHA256     | `86ec9038392837f4dca639a4b0d6f5e0d58b267b894bdf796013d18cf795c238` |

# Preserved failure boundary

The first generic setup command, Prisma generation against `prisma/schema.sqlite.prisma`, attempted to fetch the Debian OpenSSL 3 query-engine checksum for engine commit `c2990dca591cba766e3b7ef5d9e8a84796e47ab7`. The HTTPS request failed and stderr retained an empty underlying reason. A certificate, TLS, HTTP or network subcause is not established by that output. The profile classified the failure as `SUITE_FIXTURE_CONTRACT_UNSATISFIED`; this is not a reproduced reverse-Receive failure.

No Playwright JSON report, browser-runtime receipt, Device Lab receipt or technical screenshot was produced. These absences are explicit in the original receipt and [accounting observation](absence-and-accounting.observation.json). The infrastructure checksum request is distinct from the recorded zero product-provider calls.

# Original evidence and independent preservation

The [preservation index](preservation-index.json) binds exact copies of all six original published outputs, the canonical receipt, common-Git markers, outer stdout/stderr/terminal, held-context checks, the postfailure custody observation and prior nonexecuting admission failures. Empty stdout/stderr files remain empty. Copied raw files were not formatted or rewritten. The original publication index retains its original paths as provenance; this bundle's index binds the new publication paths and excludes itself.

The [independent preservation assessment](independent-preservation-audit/assessment.json) verified 12 source outputs, byte-identical receipt/marker copies, terminal hashes, all 2,589 working and committed runtime files, and the canonical source digest. Tracked source remained unchanged; only generated evidence was untracked. This is preservation review, not a new Product Experience review.

Held-context PASS checks establish read-only source/history admission with zero executions. Earlier HTTP401 admission failures remain separate diagnostic history. The [root-assembled GET-only custody observation](postfailure-custody.observation.json) records all six R12 remote slots absent at `2026-10-17T02:03:15.787Z`; it is normalized author observation, not raw HTTP or a replacement execution receipt.

# Static prerequisite diagnosis remains nonaccepting

The [static diagnosis](static-prerequisite-diagnosis/static-diagnosis.receipt.json), official checksum bodies and source excerpts distinguish the existing `@prisma/engines` binaries from the separate `node_modules/prisma` generator targets. They describe exact binary comparisons, target provisioning and checksum-cache sidecar rules for a future authorized workspace. Source excerpts carry their stated presentation newline. The [independent prerequisite review](static-prerequisite-diagnosis/independent-review.receipt.json) records the limits of this source-level analysis.

No native engine load, engine CLI, Prisma generation, seed, build, application, database, browser or replay readiness is proved by those static materials. A harmless checksum-fetch probe is separately classified if preserved; it cannot establish setup or product acceptance. Actual readiness proof remains future. The later [equivalent Node HTTPS probes](checksum-fetch-environment-probe/node-get-environment-probe.receipt.json) observed direct-connection refusal under the current sanitized profile and a certificate-chain error with proxy variables alone. A [separate ordinary configured proxy-and-trust probe](checksum-fetch-environment-probe/ordinary-configured-trust-probe.receipt.json), restoring existing trust settings without disabling verification, received HTTP200 with the same official checksum body. These probes did not invoke the private bundled Prisma fetch function and do not establish the original request's hidden subcause or any engine/setup readiness. Their script and exact stdout/stderr remain preserved.

The independent static receipt retains its historical prerequisite recommendation. It does not approve a later R13 preflight contract, including any isolated database, build or empty-browser readiness scope; that contract requires its own source-bound successor review and protected acceptance.

# Successor boundary

This failure-only publication grants no retry, refund, reset, corrected entry, ordinary invocation, replacement seal or merge. Preserve R12 and every earlier original, the campaign epoch and expiry, review7/submission3 and historical seals. Any further execution requires separately reviewed, normally protected successor authority with exact source admission and a proper finite entitlement. Complete current technical and Product Experience replay evidence, canonical finalizer, exact qualified seal, whole protected workflow/Mainline success and landed verification remain required. Existing #722 and dependent spatial integration remain held.
