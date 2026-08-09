---
title: Project Admiralty Phase 2 Privacy Matrix
audience: product-engineering-security-operations-support
status: current
canonical_for: project-admiralty-phase-2-privacy
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 2 privacy matrix

| Surface              | Permitted                                                                | Prohibited                                                              | Additional gate                                                 |
| -------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| People search        | display name, masked/administrative email, stable ID, lifecycle summary  | password/session/OAuth secrets, private profile prose                   | `ACCOUNT_OBSERVE`, bounded/rate-limited query                   |
| Account dossier      | roles/capabilities, security/lifecycle summaries, sanitized events       | hashes, CSRF, tokens, provider scopes, private content                  | `ACCOUNT_OBSERVE`; support diagnostic scopes remain grant-bound |
| Support diagnostics  | exact approved sanitized scopes                                          | unapproved scope, wrong operator/target, expired/revoked grant          | recent assurance plus active Phase 1 consent grant              |
| Chronicle/Voyage     | operational metadata, versions, crew, sanitized event type/time          | unrevealed content, event payloads, variables, inventory, previews      | domain observe capability                                       |
| Community            | listing/release and moderation workload summaries                        | reporter identity, private report/evidence prose, raw manifests         | `COMMUNITY_OBSERVE`                                             |
| Operations/providers | safe provider/job/backup/restore state                                   | payloads, object keys, bucket/storage names, encryption material        | relevant observe capability                                     |
| Audit/investigation  | human-readable sanitized action, actor/target/correlation, safe metadata | raw request/response bodies, secret-like metadata, authorization bypass | `AUDIT_OBSERVE` or filtered investigation authority             |

Unauthorized administrative routes fail before privileged projection and use a
non-revealing not-found response. Navigation filtering is a usability aid, not
an authorization boundary. Sensitive reads retain canonical Phase 1 audit
rules; aggregate dashboard refreshes are not individually audited to avoid
evidence noise.

No Phase 2 path returns `SECRET`. No canonical database or private fixture is
used for testing. Browser and walkthrough evidence uses reserved synthetic
identities in a task-owned SQLite database, with credentials stored only in a
private task-root handoff.
