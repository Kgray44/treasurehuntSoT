---
title: Project Sounding Line Phase 4 Worker Trust and Security Model
audience: engineering
status: planned
canonical_for: sounding-line-phase-4-worker-trust
last_reviewed: 2026-07-29
---

# Phase 4 Worker Trust and Security Model

## Trust classes and execution policy

| Trust class                   | Permitted future work                                     | Prohibited work                                   |
| ----------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `LOCAL_TRUSTED`               | local sealed plans and synthetic fixtures                 | authority issuance, shared secrets                |
| `CI_TRUSTED`                  | verified repository gates and release evidence            | unapproved providers, foreign repositories        |
| `PROVIDER_VALIDATION_TRUSTED` | explicitly authorized provider proof                      | general release authority                         |
| `EXTERNAL_RESTRICTED`         | bounded external-host nodes with synthetic/minimal inputs | secrets, private content, authoritative decisions |
| `UNTRUSTED_PR`                | isolated, non-secret pull-request checks                  | protected evidence or deploy-capable nodes        |
| `QUARANTINED`                 | no execution                                              | every node and artifact write                     |

A node declares its minimum trust class and capabilities. The matcher requires
an exact policy allow-list match; broader privilege never substitutes for a
missing capability or authorization.

## Enrollment and least privilege

Future enrollment binds a worker identity to controller trust domain, host/boot
identity, attestation state, and a short-lived credential. Credentials are
single-purpose, scoped to a run/node/artifact prefix, and renewed only after
fresh attestation and heartbeat. No durable worker token, repository secret, or
real provider credential belongs in this preparation branch. Source checkout
identity and dependency-lock digest are independently verified before command
selection. Untrusted pull-request code is treated as hostile and cannot access
protected secrets, caches, artifacts, or a trusted checkout.

## Evidence and secret protection

Evidence integrity uses canonical serialization, digest-bound manifests, and
future signer identities; this preparation creates neither signer nor key.
Artifact hashes, redacted logs, minimal synthetic fixtures, and task-owned
storage are mandatory. Secret access is opt-in per node, provider-scoped, and
redacted from output. A worker may not claim a capability through a log or
metadata value alone; the controller validates registered capability evidence.

## Threat response rules

| Threat                           | Mandatory response                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| forged or replayed evidence      | reject manifest, revoke affected receipt, quarantine identity                         |
| compromised/revoked worker       | stop leases, rotate future credential, rebuild trusted identity, rerun affected nodes |
| clock skew or network partition  | reject renewal, mark unhealthy, preserve incomplete evidence, verify cleanup later    |
| cross-repository contamination   | reject checkout/lock identity, isolate storage, investigate cache boundary            |
| secret exposure                  | stop work, redact/restrict artifacts, revoke access, assess release impact            |
| untrusted pull-request execution | isolate sandbox; no protected evidence, secret, or release authority                  |

The controller fails closed when worker, source, policy, digest, cleanup, or
attestation identity is absent, stale, contradictory, or revoked.
