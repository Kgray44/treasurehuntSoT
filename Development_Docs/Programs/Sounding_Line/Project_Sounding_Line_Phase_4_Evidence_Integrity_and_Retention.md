---
title: Project Sounding Line Phase 4 Evidence Integrity and Retention
audience: engineering
status: planned
canonical_for: sounding-line-phase-4-evidence-retention
last_reviewed: 2026-07-29
---

# Phase 4 Evidence Integrity and Retention

## Evidence manifest

Future receipts use canonical JSON and SHA-256 or an accepted stronger digest.
Each manifest binds source, policy, dependency-lock, worker, environment,
selection/counts, contract evidence, artifact hashes, cleanup identity,
retention class, expiration, and revocation state. The manifest chain is
append-only: a correction creates a successor record, never a silent rewrite.
This preparation provides a draft shape only and creates no signing key.

## Validity, privacy, and retention

Invalid evidence includes mismatched source/policy, forged or revoked worker,
missing artifact, incomplete counts, stale receipt, tampered manifest, missing
cleanup, or broken chain. Invalid evidence revokes its decision and triggers
revalidation of affected descendants. Retention classes distinguish release,
security incident, ordinary validation, and short-lived debug artifacts.
Expiration, legal/privacy limits, access control, backup, restore verification,
and destruction rules are policy-controlled. Logs/traces are redacted and use
synthetic data; private content, credentials, and unrestricted location/session
data are never retained as general evidence.

Phase 2 receipts are the required local predecessor: allocation, adapter
start/finish, lease release, cleanup, and quarantine bind the controller token
and resource identity. A future manifest must additionally bind Phase 2
process/PID-reuse identity, SQLite clone receipt, browser-context/storage/trace
identity, loopback-server token, policy version/digest, and reviewed adapter.
The P34 exception and external-provider debt must remain explicit evidence
status, never disappear through receipt normalization.
