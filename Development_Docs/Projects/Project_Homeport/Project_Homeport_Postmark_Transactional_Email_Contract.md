---
title: Project Homeport Postmark Transactional Email Compatibility Contract
audience: product-engineering
status: historical
canonical_for: project-homeport-postmark-transactional-email-contract
last_reviewed: 2026-08-06
---

# Project Homeport Postmark Transactional Email Compatibility Contract

This contract is retained for the dormant Postmark adapter. It is superseded for
new real-provider work by the
[Resend contract](Project_Homeport_Resend_Transactional_Email_Contract.md).

## Scope

Compatibility behavior for the retained Postmark adapter. Postmark is not the
selected real provider and does not block Patch A.

## Required behavior

- One delivery port serves verification, password reset, email change, email-change notice, and security notice; production never silently discards a required delivery.
- Postmark configuration requires server token, verified sender/name, transactional Message Stream, and approved template aliases. Typed template models exclude secrets from metadata and logs.
- Successful submissions persist provider MessageID and secret-safe status for correlation. Provider failures are classified without exposing token, sender internals, recipient, code, reset token, or body.
- Delivery, bounce, and spam-complaint webhooks use HTTPS in live environments, configured HTTP Basic authentication, strict payload validation, MessageID idempotency, and retry-safe processing. Postmark does not provide an HMAC webhook signature contract, so no fabricated signature check is claimed.
- The synthetic adapter writes only inside HOMEPORT_PHASE7_TASK_ROOT and proves application behavior, not external delivery. Live proof requires provider submission, real inbox receipt, and correlated evidence.
- Implementation follows current official Postmark documentation for [API sending](https://postmarkapp.com/developer/user-guide/send-email-with-api), [template sending](https://postmarkapp.com/developer/api/templates-api), [webhook behavior](https://postmarkapp.com/developer/webhooks/webhooks-overview), [spam complaints](https://postmarkapp.com/developer/webhooks/spam-complaint-webhook), and [verified sender signatures](https://postmarkapp.com/developer/user-guide/managing-your-account/managing-sender-signatures).

## Verification

- adapter contract tests
- synthetic outbox isolation/privacy
- Postmark mocked response/error tests
- webhook authentication/idempotency
- optional configured real-inbox verification

## Truth boundary

This architecture contract does not prove implementation, migration, live inbox delivery, evidence acceptance, Sounding Line authority, publication, owner acceptance, merge, PR, or deployment.
