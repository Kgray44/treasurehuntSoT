---
title: Configuration
audience: administrator
status: current
canonical_for: administrator-configuration
last_reviewed: 2026-08-09
---

# Configuration

Configure database connectivity, application origin, authentication, and any optional provider integrations through environment variables. Keep values in a deployment secret store; do not add them to documentation, source, screenshots, or issue reports.

Before enabling a provider, confirm its storage, scanning, and recovery behavior in a non-production environment. See [environment variables](../reference/environment-variables.md), [private content](private-content.md), and [security architecture](../developer/security-architecture.md).

For a non-loopback Next.js development hostname, configure only exact names in
`HOMEPORT_ALLOWED_DEV_ORIGINS`; never use wildcards, schemes, ports, or paths.
Set `HOMEPORT_PUBLIC_APP_ORIGIN` to the exact public HTTP(S) origin so account
links and OAuth post-callback redirects do not inherit a bind, loopback, or
reverse-proxy address. Browser destinations do not trust arbitrary `Host` or
forwarded-host headers; production fails closed for bind, loopback,
private-network, and internal hostnames. Origin diagnostics are disabled unless
`HOMEPORT_ORIGIN_DIAGNOSTICS=1` and are unavailable in production.

Google and GitHub application OAuth require separate server-only credentials
and exact callbacks. Follow the [OAuth configuration guide](oauth-configuration.md);
never place client secrets in `.env.example`, a `NEXT_PUBLIC_` variable, or a
committed environment file.

Project Admiralty administrators are existing canonical accounts. Use the
[Admiralty bootstrap guide](admiralty-bootstrap.md) to rehearse and explicitly
commit role reconciliation after backup and migration review. Do not create a
second administrator account system, treat an environment variable as runtime
authorization, or expose a bootstrap HTTP endpoint.

## Phase 7 correction Round 3 status

Correction Round 3 uses Resend as the selected real transactional-email
provider and retains a task-owned synthetic adapter for isolated validation.
Follow the [Resend configuration guide](resend-configuration.md). Owner Re-Review
Round 3 remains `PENDING_OWNER_DECISION`; the source is on main but not deployed.
