---
title: Project Admiralty Support Pilot S1 Architecture
audience: product-engineering
status: current
canonical_for: admiralty-support-pilot-s1-architecture
last_reviewed: 2026-08-27
---

# Project Admiralty Support Pilot S1 Architecture

## Purpose

Support Pilot S1 opens a human-readable support case and performs one bounded
autonomous diagnostic workflow:

`support case -> owner-approved Support Access -> delegated execution grant -> read-only diagnosis -> auditable evidence`

The implementation is intentionally additive. Wayfarer remains the canonical
identity, session, and Support Access owner. One Voyage, Harborlight,
operations, and the audit store remain owners of their own projections.
Admiralty coordinates only named, typed, sanitized reads.

## Delegated capability

`SupportExecutionGrant` is derived at execution time from all of the following:

- the authenticated operator and their canonical `SUPPORT_USE` capability;
- one exact `SupportCase` created by that same operator;
- the exact approved `SupportAccessGrant` linked to the case request;
- the target account, approved diagnostic scopes, and data classifications;
- the earlier of the parent grant expiry and the S1 execution lifetime; and
- the immutable `READ_ONLY` risk ceiling.

The validator fails closed if the case, operator, target, request, scope, grant
status, revocation state, or expiry does not match. An administrator role by
itself does not replace user consent.

## Persisted support records

The support domain is decomposed into typed records rather than an opaque case
blob:

- `SupportCase` and its linked canonical `SupportAccessRequest`;
- `SupportExecutionGrant` and `SupportExecutionSession`;
- `SupportObservation` and `SupportEvidenceReference`;
- `SupportFinding` with its evidence links;
- `SupportDiagnosis`; and
- `SupportRepairProposal`.

Only safe summaries, classifications, source references, timestamps, and
SHA-256 digests are retained for diagnostic observations. Projection payloads,
private content, credentials, secrets, raw logs, and unrestricted shell or
filesystem access are not persisted or exposed.

## Diagnostic ports

S1 executes only scopes approved by the target owner. The scope registry names
account/profile/session/authentication, Chronicle history metadata, Voyage
membership, Community activity, safe runtime status, audit correlation, and
Tideglass diagnostics. Each result is converted into a source-bound observation
with a classification and digest before a finding is derived.

No S1 path accepts arbitrary SQL, filesystem, shell, command, retry, rebuild,
session-revocation, configuration-mutation, or user-state-correction input.

## Diagnosis and proposals

Diagnosis rules are deterministic and evaluate only bounded facts. A finding
records confidence and uncertainty. The resulting repair proposal is always
`INFORMATION_ONLY`: it can explain a future owner-domain action and its consent
or administrator requirements, but it has no executor, command identifier, or
mutation path.

## User experience

`/admin/support/cases` lets an authorized operator open an exact case, request
owner consent, see expiry/revocation state, start a recently-assured read-only
diagnosis after approval, and inspect findings, source provenance, diagnosis,
and the information-only next action. The screen states that S1 cannot repair
anything.

## S1 boundary

Support Pilot S1 does not implement S2 repair registration, S3 systemic
intelligence, autonomous repair, direct database mutation of owned user or
platform state, background-job retry, projection rebuild, configuration change,
or agent-controlled session revocation.
