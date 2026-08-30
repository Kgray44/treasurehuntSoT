---
title: Project Admiralty Support Pilot S3 Completion Receipt
audience: product-engineering
status: accepted-mainline
canonical_for: project-admiralty-support-pilot-s3-completion
last_reviewed: 2026-08-30
---

# Project Admiralty Support Pilot S3 completion receipt

Support Pilot S3, **Close the Case**, is accepted on protected main. Protected
PR #508 used base `14d638f3a342b93528539ced4261ba495f8f3a0d`, candidate
`5b60598d3b421c9d5c608604f2c085ededa06689`, and ordinary Sounding Line run
`33199305087`; it merged as `34c8be0721a72100c740485d54b89e220e0ccf77`.

S3 lets only the opening, recently assured operator close a quiescent support
case. It cancels unanswered consent and revokes active parent and delegated
case-derived grants before recording the durable `CLOSED` audit result. Repeat
closure is idempotent. S3 does not authorize a repair, raw data access, broad
administrative mutation, audit rewriting, or a new support authority.

The later generic isolated-fixture repair in PR #625 and current Bridgewatch /
Admiralty operational integration in PR #626 retain this contract's synthetic
browser coverage; they do not broaden its consent, repair, or privacy boundary.
