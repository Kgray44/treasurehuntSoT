---
title: Configuration
audience: administrator
status: current
canonical_for: administrator-configuration
last_reviewed: 2026-08-05
---

# Configuration

Configure database connectivity, application origin, authentication, and any optional provider integrations through environment variables. Keep values in a deployment secret store; do not add them to documentation, source, screenshots, or issue reports.

Before enabling a provider, confirm its storage, scanning, and recovery behavior in a non-production environment. See [environment variables](../reference/environment-variables.md), [private content](private-content.md), and [security architecture](../developer/security-architecture.md).

## Phase 7 correction Round 3 status

Correction Round 3 uses Resend as the selected real transactional-email
provider and retains a task-owned synthetic adapter for isolated validation.
Follow the [Resend configuration guide](resend-configuration.md). Owner Re-Review
Round 3 remains `PENDING_OWNER_DECISION`; the branch is not merged or deployed.
