---
title: Project Homeport Phase 7 Correction Round 3 Patch A Implementation Report
audience: product-engineering
status: current
canonical_for: project-homeport-phase-7-correction-round-3-patch-a-implementation-report
last_reviewed: 2026-08-06
---

# Project Homeport Phase 7 Correction Round 3 Patch A implementation report

## Result

Focused Patch A resolves the local account and route blockers. Pending
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
background-only frames are prevented. The critical authentication addendum also
removes legacy GameMaster requirements from ordinary Captain and Creator paths:
one canonical AccountSession provides workspace entry while Voyage, Chronicle,
asset, invitation, helper, and collaboration rules remain resource-specific.

## Source identity

- Published Patch A baseline: `58f88e6ec1447d19b07213003c3499c4b4c0c884`
- Exact product/browser source: `0edae8a4509656f98d68aa248f6ee7fb087436eb`
- Mainline authority source after test-boundary alignment: `28442ddd6d8932aff1dab5fc41d51a63ccad342c`
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

Resend supersedes Postmark as the selected real provider. The provider-neutral
`TransactionalEmailProvider`, task-owned synthetic outbox, delivery ledger, and
dormant Postmark compatibility adapter remain. `ResendTransactionalEmailProvider`
uses the official Node SDK, persists only provider acceptance metadata, and
renders verification, recovery, email-change, lifecycle, and security messages
through the same governed boundary.

The live-provider steps are:

1. Verify the Resend sending domain's SPF, DKIM, and MX records.
2. Place a domain-restricted Sending access key and verified From identity in
   ignored `.env.local` using the server-only names documented in
   `docs/administrator/resend-configuration.md`.
3. Use an owner-controlled inbox for one disposable-database registration send,
   then confirm Resend acceptance, inbox receipt, and six-digit verification in
   the application.
4. Defer webhook deployment if requested; it is additive and does not replace
   the required inbox receipt.

Resend accepted two preliminary live verification messages from the exact
implementation source and the owner confirmed receipt of both messages in the
intended inbox. The owner then completed a fresh application registration:
Resend accepted provider message
`652a3347-2d49-4182-9499-399deb5957f3` at
`2026-08-07T00:27:01.379Z`, the message reached the owner-controlled inbox, and
the application consumed the received code at `2026-08-07T00:27:47.816Z`.
Direct inspection of the disposable database confirmed account status `ACTIVE`,
primary-email state `VERIFIED`, a consumed verification token, and ordinary
workspace entry. This establishes live registration-verification acceptance;
it does not establish deployment or webhook behavior.

Official setup references: [send email API](https://resend.com/docs/api-reference/emails/send-email),
[API keys](https://resend.com/docs/dashboard/api-keys/introduction), and
[domains](https://resend.com/docs/dashboard/domains/introduction).

## Captain and Creator authorization audit

| Action                     | Route/API                                                 | Current helper                                          | Current cookie                            | Replacement                 | Resource rule                                 | Final result                                |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------- | --------------------------- | --------------------------------------------- | ------------------------------------------- |
| Enter Captain              | `/captain`, `/captain/library`, `/captain/tales/[taleId]` | canonical capability resolver                           | `wayfarer_account`                        | canonical Captain workspace | verified ordinary account may enter           | canonical session retained                  |
| List/create Voyages        | `/api/captain/playthroughs`                               | `requireCaptainWorkspace`                               | `wayfarer_account` plus CSRF              | AccountSession account ID   | list/create only own Voyages                  | allowed and owner-stamped                   |
| Preview/launch Voyage      | `/api/captain/playthroughs/[playthroughId]/*`             | `requireCaptainWorkspace` plus service authority        | `wayfarer_account` plus CSRF              | canonical actor             | `captainAccountId` or migrated legacy captain | foreign resource denied                     |
| Read/control session       | `/api/captain/sessions/**`                                | `requireCaptainSession`                                 | `wayfarer_account` plus CSRF for mutation | canonical actor             | owner/migrated Captain only                   | foreign resource denied                     |
| Manage invitations         | `/api/captain/invitations/[invitationId]`                 | `requireCaptainWorkspace` plus service authority        | `wayfarer_account` plus CSRF              | canonical actor             | invitation's owning Voyage                    | foreign resource denied                     |
| Pair/revoke helper         | `/api/helper/pair/**`                                     | `requireCaptainSession`                                 | `wayfarer_account` plus CSRF              | canonical actor             | owning session only                           | foreign resource denied                     |
| Enter Creator              | `/studio`, `/studio/library`, `/studio/tales/**`          | canonical capability resolver                           | `wayfarer_account`                        | canonical Studio workspace  | verified ordinary account may enter           | canonical session retained                  |
| Create/list Chronicles     | Studio pages and tale APIs                                | `requireStudioWorkspace`                                | `wayfarer_account` plus CSRF for mutation | AccountSession account ID   | creator ownership stamped/filtered            | allowed for own resources                   |
| Edit private Chronicle     | `/studio/tales/[taleId]`, private-content APIs            | `requireStudioWorkspace` plus `requireTaleStudioAccess` | `wayfarer_account` plus CSRF              | canonical actor             | owner, scoped collaborator, or admin          | foreign resource denied                     |
| Read Studio media          | `/api/media/[assetId]`                                    | `requireOwnedStudioAsset`                               | `wayfarer_account`                        | canonical actor             | asset must belong to an authorized Chronicle  | foreign resource denied                     |
| Legacy GM endpoints        | `/api/gm/**`                                              | legacy adapter                                          | legacy-compatible internal cookie         | none in ordinary flow       | compatibility only                            | retained, not reachable as ordinary sign-in |
| Private operations console | `/studio/private-content/operations`                      | `requireGmCapability("ADMIN")`                          | privileged internal authority             | none                        | explicit admin-only operation                 | classified privileged, not ordinary Creator |

## Boundary

This remains branch-only Patch A work until all final gates and publication
checks complete. It does not rewrite prior
owner history, establish broader owner acceptance, merge to `main`, create a
pull request, or deploy. Correction Round 3 remains `PENDING_OWNER_DECISION`.
