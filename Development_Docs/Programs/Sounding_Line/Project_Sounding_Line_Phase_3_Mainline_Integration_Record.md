---
title: Project Sounding Line Phase 3 Mainline Integration Record
audience: engineering
status: current
---

# Project Sounding Line Phase 3 Mainline Integration Record

## Identity and decision

| Field              | Value                                                                               |
| ------------------ | ----------------------------------------------------------------------------------- |
| Source branch      | `codex/project-sounding-line-phase3-read-the-current`                               |
| Source head        | `0d2ed72d9d3dc314adda28398cae90901975b448`                                          |
| `origin/main` base | `ee5cffd457708559041cfc3331eb315906812e15`                                          |
| Integration branch | `integration/sounding-line-phase3-mainline`                                         |
| Integration merge  | `d01f340e38a5194f1ee887d73d2bcdca88249a57`                                          |
| Merge method       | `--no-ff`                                                                           |
| Conflicts          | None                                                                                |
| Mainline decision  | Accepted for the authorized fast-forward after this record's exact-merge validation |

The source head is an ancestor of the integration merge. The merge preserved the
Phase 3 history; it did not squash or rewrite the local-completion receipt.

## Reconciled repository truth

The accepted source provides Phase 3's schema-2 local historical store with the
ordered migrations `001-initial.sql` and `002-historical-entities.sql`, receipt
ingestion compatibility, impact planning, freshness and invalidation decisions,
failure/cascade classification, rerun and shard planning, and governed durable
controller recovery. The exact integrated policy is version `1.1.0`, digest
`c0cf74d2c24e23a2bd0a2d40a6efee0a9c342ac5c2576f49f61301abc726c946`.

Inventory reconciliation reports 14 suites, 17 contracts, 9 owners, 19
resources, 6 gates, 2 validation-debt records, 191 suite children, and zero
critical unknowns. Existing local, non-authoritative Phase 2/3 pilot records
remain outside the repository; no populated historical store was committed.

## Limits and rollback

The external MySQL/provider gates remain `EXTERNAL_PENDING`. The P34 full
browser matrix remains the accepted bounded, non-green exception:
`P34-BME-20260729`. This integration neither converts it into a pass nor claims
a completed green matrix.

Rollback before a later mainline descendant is created is the ordinary
fast-forward refusal: do not publish this branch. After publication, use a new
revert commit for the relevant Phase 3 or documentation commit; do not rewrite
`main` or the preserved source branch.

Execution usage:

- Elapsed time: UNAVAILABLE_FROM_HOST
- Total tokens: UNAVAILABLE_FROM_HOST
- Input tokens: UNAVAILABLE_FROM_HOST
- Output tokens: UNAVAILABLE_FROM_HOST
