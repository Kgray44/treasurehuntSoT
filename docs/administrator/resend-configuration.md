---
title: Resend transactional email configuration
audience: product-engineering
status: current
canonical_for: resend-transactional-email-configuration
last_reviewed: 2026-08-07
---

# Resend transactional email configuration

Resend is the selected real transactional-email provider. The provider-neutral
`TransactionalEmailProvider` boundary and task-owned synthetic outbox remain in
place; Postmark is retained only as a dormant compatibility adapter.

## Server-only setup

1. Add a sending domain in Resend and publish the exact SPF, DKIM, and MX records
   Resend supplies. A dedicated sending subdomain is preferred.
2. Create a Resend API key with **Sending access** restricted to that domain.
3. In the ignored server file
   `C:\Users\kkids\Documents\Codex_TreasureHunt-homeport\.env.local`, set
   `HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER=RESEND`, `RESEND_API_KEY`,
   `RESEND_FROM_ADDRESS`, `RESEND_FROM_NAME`, and the exact server-only
   `HOMEPORT_PUBLIC_APP_ORIGIN`.
4. Prove a real registration send in a disposable database, Resend API
   acceptance, receipt in an owner-controlled inbox, and successful application
   consumption of the six-digit code before claiming live verification works.

Never use a `NEXT_PUBLIC_` variable for provider credentials, put a real secret
in `.env.example`, or paste a key into chat. `.env.local` is ignored by Git.

Official references: [send email API](https://resend.com/docs/api-reference/emails/send-email),
[API keys](https://resend.com/docs/dashboard/api-keys/introduction),
[domains](https://resend.com/docs/dashboard/domains/introduction).

Webhook implementation and deployment are explicitly deferred and are not part
of this patch.

These instructions describe the Round 3 branch. They do not claim deployment,
owner acceptance, production MySQL proof, or physical assistive-technology
validation.
