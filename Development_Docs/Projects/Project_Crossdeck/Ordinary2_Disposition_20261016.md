---
title: Crossdeck consumed ordinary2 inventory failure disposition
audience: engineering
status: failed-qualification-consumed-infrastructure
canonical_for: crossdeck-ordinary2-failure-20261016
last_reviewed: 2026-10-16
---

# Consumed ordinary2 before verification commands

Whole protected [run 38929134845](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38929134845) failed on attempt one. Custody passed, focused verification failed and Mainline Decision correctly refused qualification. [PR #721](https://github.com/Kgray44/treasurehuntSoT/pull/721) returned to draft to prevent a source publication from triggering an unauthorized synchronize invocation. No qualified seal exists. This failure consumes ordinary2; no reset, refund, retry or merge is authorized by this record.

| Binding        | Actual value                                                       |
| -------------- | ------------------------------------------------------------------ |
| Candidate      | `0c9d4c0741c016d83a40abd176cd6b2bb8bf8f5b`                         |
| Tree           | `d01cbdae76db4ac460f3474cb857bc779f59963f`                         |
| Accepted base  | `43340791355526fb31fe2dbf9274eb8632589b30`                         |
| Current source | `ae8467e130cceca9fde7ffa6eb0ff4801deea503690daa9d10114747e7402136` |
| Contracts      | `33b7621269fa18417c20713ccc185783861ef043e38a527f727df7e1047c7274` |
| R8 record      | `ecbd09233751b59bd4d5b5d29ec505789944f8a87f4627feaf559461dfde7e37` |
| Reconciliation | `b8b55b2051d0b176271f07a195ad7a57acd7fc594374f1cbfab532c71c289c11` |

The [original decision ZIP, workflow records and log](evidence/ordinary2-failed-20261016/preservation-index.json) retain artifact `12058059957` with server/archive digest `sha256:d1f348a90409bde9fd35b4818b8ee22dd569b1209e94d54ff0d625cf796c579c`. Whole workflow duration was 636s. Classification preflight took 119062ms and the decision records successful trusted historical attestation. Its command list is empty, browser diagnostics are null and no experience replay result exists. No product build, technical suite or experience replay executed. CI dependency installation and Chromium provisioning did execute.

## Independently reproduced cause

The hosted error is sanitized to `SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED`; a raw hosted ENOBUFS error was not preserved. Root and the separate existing authority owner independently reproduced the exact committed inventory read without running the application, a browser, capture or any verification command. The 9,520-entry inventory is 1,541,876 bytes, SHA256 `a4218c12f4d32412e8051e9967610570013671382fd69e6bde2dc531e4b82297`. The unchanged trusted `ordinary.mjs` function `trackedEntries` invokes `git ls-tree -rz` with Node's default 1 MiB output buffer. That exact read fails with ENOBUFS; a finite 64 MiB read returns the complete inventory. Root also invoked the exported nonexecuting `buildEvidenceObligations` with the exact cached plan and reproduced the same first-operation failure.

The planner calls this inventory operation before `runCommand`, matching the hosted empty command list. This source-bound reproduction identifies an infrastructure defect; it does not turn the generic hosted error into an originally captured ENOBUFS stack. The [unaltered read-only diagnosis](evidence/ordinary2-failed-20261016/independent-read-only-diagnosis.original.raw.txt) preserves both actual local errors, complete-read size/hash and the consumed qualification reservation.

## Continuation boundary

Preparation18, independent review7 and authenticated submission3 retain their original whole-success records, source tuples, artifacts and four custody seals. Product source, contracts, original expiry and all failure history remain unchanged. The existing Sounding Line authority owner is preparing the narrow canonical buffer correction and a separately reviewed/protected finite current-base qualification successor under standing owner completion authorization. That successor must preserve this consumed run and qualify the actual new candidate with all six technical suites, all 38 experience contexts and whole-workflow/Mainline success before normal protected merge and landed smoke. It cannot borrow this spent slot. No new capture, product review or local proof is granted here.

The next prequalification admission must exercise the complete nonexecuting evidence-obligation planner and validate full inventory size/content before claiming an invocation. Physical/native/provider/field and product-owner acceptance remain separate.
