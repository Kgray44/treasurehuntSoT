---
title: Security architecture
audience: security
status: current
canonical_for: security-architecture
last_reviewed: 2026-08-09
---

# Security architecture

Security boundaries include authenticated role access, resource ownership, invitation and session policy, immutable publishing, public projections, input validation, audit-oriented domain records, and protected private-content operations. Authorization is enforced in services and routes; UI visibility alone is not a security control.

Private-content handling separates access, storage, scanning, derivatives, grants, withdrawal, and recovery. Logs and test fixtures must not contain private material or secrets. See [public reporting](../../SECURITY.md) and [private-content operations](../administrator/private-content.md).

## Admiralty privileged operations

Project Admiralty Phase 1 resolves administrator and operator capabilities from
current canonical account role assignments on every privileged request. The
limited `/admin` shell is not an authorization boundary. Unauthorized access is
denied before projection, sensitive mutations and support reads require recent
password reauthentication bound to the same live account session, and role or
session revocation invalidates that assurance immediately.

Support Access is target-, operator-, scope-, and time-bound. It requires an
explicit user decision and can be revoked immediately. Safe projections and
recursive audit sanitization exclude credentials, tokens, provider secrets,
encryption keys, private Chronicle prose, and private media. Critical state
changes and their canonical audit event share a transaction. See the
[Support Access guide](../user/support-access.md) and [administrator bootstrap](../administrator/admiralty-bootstrap.md).

## Tideglass comparison and annotation boundaries

Project Tideglass Phase 2 derives its maximum projection audience on the
server. Current APIs require the canonical account session, active Creator
workspace, and Chronicle ownership or scoped Creator collaboration; an
administrator label alone does not grant annotation authority. Source and
target editions are independently authorized and checksum-bound. Annotation
mutations additionally require CSRF, centralized per-account/Chronicle rate
limits, strict bounded plain-text input, exact Change-ID lineage, immutable
revision ownership, and sanitized audit metadata. Public counts are computed
only from visible records, and no API returns raw published snapshots, answers,
Creator/Captain notes, storage paths, sessions, credentials, or hidden IDs.

## Phase 7 correction Round 3 status

Correction Round 3 uses one canonical AccountSession for ordinary Player,
Captain, and Creator entry while enforcing owner/scoped-collaborator rules on
private resources. Resend is the selected real email provider; its key remains
server-only, and synthetic delivery remains task-owned test infrastructure.
Owner Re-Review Round 3 remains `PENDING_OWNER_DECISION`.
