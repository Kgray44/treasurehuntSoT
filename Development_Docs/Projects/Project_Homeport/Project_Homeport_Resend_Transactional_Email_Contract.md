---
title: Project Homeport Resend Transactional Email Contract
audience: product-engineering
status: current
canonical_for: project-homeport-resend-transactional-email-contract
last_reviewed: 2026-08-06
---

# Project Homeport Resend Transactional Email Contract

## Scope

Provider-neutral transactional delivery with Resend as the selected real
provider and a task-owned synthetic adapter for isolated validation. The
Postmark adapter is compatibility-only.

## Required behavior

- One `TransactionalEmailProvider` port serves verification, password reset,
  email change, lifecycle, and security notices.
- Production selects Resend and fails closed when `RESEND_API_KEY`,
  `RESEND_FROM_ADDRESS`, or `RESEND_FROM_NAME` is absent. Synthetic delivery is
  never an implicit production fallback.
- The official Resend Node SDK sends both text and HTML, applies an idempotency
  key, and records the provider email ID and secret-safe status. Codes, action
  tokens, recipient addresses, API keys, and message bodies never enter the
  delivery ledger or committed evidence.
- The synthetic adapter writes only inside `HOMEPORT_PHASE7_TASK_ROOT` and
  proves application behavior, not external delivery.
- Live email verification requires Resend API acceptance, real inbox receipt,
  and successful application consumption of the received six-digit code in a
  disposable database. Provider `delivered` status alone is not inbox proof.

Implementation follows current official Resend documentation for the
[send email API](https://resend.com/docs/api-reference/emails/send-email),
[API keys](https://resend.com/docs/dashboard/api-keys/introduction),
[domains](https://resend.com/docs/dashboard/domains/introduction).

## Truth boundary

Webhook implementation and deployment are deferred. This contract does not
establish deployment, owner acceptance, merge, pull request, or production
MySQL behavior.
