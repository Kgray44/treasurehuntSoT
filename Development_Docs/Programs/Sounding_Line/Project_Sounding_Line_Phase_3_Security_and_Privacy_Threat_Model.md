---
title: Project Sounding Line Phase 3 Security and Privacy Threat Model
audience: engineering
status: current
---

# Security and privacy threat model

| Threat                                                  | Preventive control                                                 | Detective control and recovery                                |
| ------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| Forged receipt, policy snapshot, reuse, or resume token | canonical digest, identity binding, signed/controlled future store | checksum mismatch quarantines evidence; create new plan       |
| Replay across commit/environment                        | source/policy/environment/baseline identity                        | freshness rejects replay; preserve forensic metadata          |
| History/signature/flake poisoning                       | append-only provenance, redaction, owner review, bounded inputs    | anomaly review; revoke affected aggregates                    |
| Secret/private trace leakage                            | allowlist schema, redaction, retention class, restricted artifacts | scanner rejects/quarantines; purge under controlled retention |
| Artifact traversal or unbounded growth                  | rooted references, safe identifiers, quotas/retention              | audit and halt writes; preserve minimal receipts              |
| Planner omission or compromised report                  | deterministic explainable plan and completion validation           | parity comparison and gate refusal                            |

Residual risks are unavailable external evidence, compromised host, and future-store key custody; none may be hidden as passing evidence. Synthetic tests verify redaction and fail-closed identity handling.
