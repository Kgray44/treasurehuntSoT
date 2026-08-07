---
title: Environment variables
audience: reference
status: current
canonical_for: environment-variables
last_reviewed: 2026-08-07
---

# Environment variables

Use `.env.example` as the canonical variable-name reference. Values for database connectivity, authentication, application origin, storage, scanning, and provider integrations are deployment secrets and are never documented here. Confirm the Prisma schema matches the configured database protocol.

See [configuration](../administrator/configuration.md) and [security architecture](../developer/security-architecture.md).

`HOMEPORT_PUBLIC_APP_ORIGIN` is the server-only exact HTTP(S) origin used for
transactional account links. `HOMEPORT_ALLOWED_DEV_ORIGINS` is a comma-separated
list of exact development hostnames; `scripts/start-dev.ps1 -Lan` adds the
current LAN IPv4 address only for that process. `HOMEPORT_ORIGIN_DIAGNOSTICS=1`
enables sanitized host/protocol diagnostics in non-production only. Do not use
wildcards or put secrets in these values.

The selected real transactional-email provider uses server-only
`HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER=RESEND`, `RESEND_API_KEY`,
`RESEND_FROM_ADDRESS`, and `RESEND_FROM_NAME`. Put real values in ignored
`.env.local` or the deployment secret store, never in `.env.example` or a
`NEXT_PUBLIC_` variable. Webhook work is deferred and has no configuration
requirement in this patch.

Google and GitHub OAuth use only server-side variables:
`VOYAGEWRIGHT_GOOGLE_CLIENT_ID`, `VOYAGEWRIGHT_GOOGLE_CLIENT_SECRET`,
`VOYAGEWRIGHT_GOOGLE_REDIRECT_URI`, `VOYAGEWRIGHT_GITHUB_CLIENT_ID`,
`VOYAGEWRIGHT_GITHUB_CLIENT_SECRET`, and
`VOYAGEWRIGHT_GITHUB_REDIRECT_URI`. The configured redirect must exactly match
the callback registered with its provider. `VOYAGEWRIGHT_OAUTH_TEST_MODE=1`
enables the deterministic provider simulator only outside production. See the
[OAuth configuration guide](../administrator/oauth-configuration.md).

## Phase 7 correction Round 2 status

Correction Round 2 is locally exact-source validated and ready for owner re-review. Dark, Light, and System themes; truthful account/Profile/workspace state; authoritative Community saves and completion-verified reviews; expanded previews; delayed loading; motion; synthetic email boundaries; and Experience Images are included. Round 2 remains `PENDING_OWNER_DECISION`; the source is on main but not deployed, and live providers remain external.

## Phase 7 correction Round 3 status

Correction Round 3 includes Resend as the selected real email provider and a
task-owned synthetic adapter for isolated validation. Owner Re-Review Round 3
remains `PENDING_OWNER_DECISION`; the source is on main but not deployed.
