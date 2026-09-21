---
title: Postmark transactional email compatibility configuration
audience: product-engineering
status: current
canonical_for: postmark-transactional-email-configuration
last_reviewed: 2026-08-06
---

# Postmark transactional email compatibility configuration

Postmark is no longer the selected real provider. This page is retained only
for the dormant compatibility adapter; new staging and production setup must use
[Resend](resend-configuration.md).

## Required setup

1. Create or select a Postmark Server and approve the sender signature/domain for the From address.
2. Create transactional templates for verification, password reset, email change, security notice, and account lifecycle; record their aliases.
3. Set server-only `HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER=POSTMARK`, `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_ADDRESS`, `POSTMARK_FROM_NAME`, `POSTMARK_TRANSACTIONAL_MESSAGE_STREAM`, `POSTMARK_TEMPLATE_ALIAS_VERIFY_EMAIL`, `POSTMARK_TEMPLATE_ALIAS_PASSWORD_RESET`, `POSTMARK_TEMPLATE_ALIAS_EMAIL_CHANGE`, `POSTMARK_TEMPLATE_ALIAS_SECURITY_NOTICE`, and `POSTMARK_TEMPLATE_ALIAS_ACCOUNT_LIFECYCLE`.
4. Configure Delivery, Bounce, and SpamComplaint webhooks to `/api/webhooks/postmark` over HTTPS. Protect the endpoint with unique `POSTMARK_WEBHOOK_USERNAME` and `POSTMARK_WEBHOOK_PASSWORD` HTTP Basic credentials. Postmark does not provide an HMAC signature contract for these webhooks.
5. Use an approved staging/test inbox. Register, receive the real code, verify the account, correlate the provider MessageID and sanitized delivery event, and retain no token or message body.
6. During provider outage, fail closed with a delivery-unavailable state. Use the synthetic adapter only in an explicitly task-owned local/test runtime; never silently substitute it in production.

No `NEXT_PUBLIC_` variable may contain provider configuration. Rotate any exposed credential immediately.

Postmark configuration no longer blocks Correction Round 3 or Patch A. No new
Postmark acceptance claim is required.

These compatibility instructions do not make Postmark the selected provider.
