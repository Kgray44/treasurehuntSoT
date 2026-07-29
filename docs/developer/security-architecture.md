---
title: Security architecture
audience: security
status: current
canonical_for: security-architecture
last_reviewed: 2026-07-27
---

# Security architecture

Security boundaries include authenticated role access, resource ownership, invitation and session policy, immutable publishing, public projections, input validation, audit-oriented domain records, and protected private-content operations. Authorization is enforced in services and routes; UI visibility alone is not a security control.

Private-content handling separates access, storage, scanning, derivatives, grants, withdrawal, and recovery. Logs and test fixtures must not contain private material or secrets. See [public reporting](../../SECURITY.md) and [private-content operations](../administrator/private-content.md).
