---
title: Project Homeport Phase 7 Correction Round 3 Patch A Implementation Report
audience: product-engineering
status: current
canonical_for: project-homeport-phase-7-correction-round-3-patch-a-implementation-report
last_reviewed: 2026-08-06
---

# Project Homeport Phase 7 Correction Round 3 Patch A implementation report

## Result

Focused Patch A resolves 21 local blocking findings and preserves
`HP-OWCR3-PATCH-A-021` as the truthful external Postmark blocker. Pending
registration is atomic; duplicate display names stay on Sign Up without
reserving email; existing email hands off to Sign In; post-commit delivery
failure leaves one explicit retryable pending account. Password strength and
confirmation have accessible text states. Returning credentials establish the
ordinary account session without an email code, while unverified status remains
a non-blocking follow-up.

One generation now owns each route transition's readiness, snapshot, loading
timer, focus, settlement, and cleanup. The ordinary crossfade is 280 ms with a
4 px incoming settle and a 500 ms loading threshold. Ready generations cancel
loading permanently, stale generations cannot write, and initially pending
settled routes retain readiness observation so old-page resurrection and
background-only frames are prevented.

## Source identity

- Published Patch A baseline: `58f88e6ec1447d19b07213003c3499c4b4c0c884`
- Exact product/browser source: `29ae357cc4df369bf33ce2dce6477618eefcbfaa`
- Branch: `codex/project-homeport-product-reality-recovery`
- Fixture: `homeport-phase7-owner-correction-round3-patch-a-v1`
- Fixture checksum: `84c5ff6cada31c91492ce218ee57a370ac3a17696cf584b0b37733741e6d92a9`
- Fixture database SHA-256: `81c1d02cd0b22f02272350f7aa8f39b79954408c39c4e67df27b8ca534526841`

## Account repair and email boundary

The DRY_RUN/COMMIT/VERIFY reconciliation command classifies incomplete pending
accounts, performs only sufficient governed repairs, preserves valid pending
accounts, and rejects canonical database paths. The exercised task-owned copy
required two repairs and verified with zero remaining actionable
inconsistencies.

No approved Postmark configuration or inbox receipt was available. The exact
classification remains `POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION`. Task-owned
synthetic delivery and code completion are proven; live provider acceptance and
inbox delivery are not.

The remaining owner actions are external only:

1. Create or open the Voyagewright Postmark server and add the sending domain.
2. Add Postmark's DKIM TXT record and custom Return-Path CNAME in Cloudflare;
   keep the Return-Path CNAME DNS-only, then wait for both to verify.
3. Create the five implementation template aliases and confirm the
   transactional Message Stream ID.
4. Place the server token, verified From identity, stream, aliases, and unique
   webhook Basic credentials into the protected staging/runtime environment
   using the server-only names documented in `.env.example`.
5. Provide an owner-controlled inbox for one real registration send, then
   confirm Postmark acceptance, inbox receipt, and six-digit verification in
   the application.

Official setup references: [sending through the API](https://postmarkapp.com/developer/user-guide/send-email-with-api),
[templates](https://postmarkapp.com/developer/api/templates-api), and
[Cloudflare DKIM/Return-Path records](https://postmarkapp.com/support/article/adding-dkim-and-return-path-records-to-cloudflare).

## Boundary

This is local, synthetic, branch-only Patch A proof. It does not rewrite prior
owner history, establish broader owner acceptance, merge to `main`, create a
pull request, or deploy. Correction Round 3 remains `PENDING_OWNER_DECISION`.
