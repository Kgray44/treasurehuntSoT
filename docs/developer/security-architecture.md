---
title: Security architecture
audience: security
status: current
canonical_for: security-architecture
last_reviewed: 2026-08-05
---

# Security architecture

Security boundaries include authenticated role access, resource ownership, invitation and session policy, immutable publishing, public projections, input validation, audit-oriented domain records, and protected private-content operations. Authorization is enforced in services and routes; UI visibility alone is not a security control.

Private-content handling separates access, storage, scanning, derivatives, grants, withdrawal, and recovery. Logs and test fixtures must not contain private material or secrets. See [public reporting](../../SECURITY.md) and [private-content operations](../administrator/private-content.md).

## Phase 7 correction Round 3 status

Correction Round 3 uses one canonical AccountSession for ordinary Player,
Captain, and Creator entry while enforcing owner/scoped-collaborator rules on
private resources. Resend is the selected real email provider; its key remains
server-only, and synthetic delivery remains task-owned test infrastructure.
Owner Re-Review Round 3 remains `PENDING_OWNER_DECISION`.
