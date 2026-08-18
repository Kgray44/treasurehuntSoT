---
title: Sounding Line v1.4.2 Bootstrap Receipt
audience: engineering
status: current
canonical_for: sounding-line-v1.4.2-bootstrap-receipt
last_reviewed: 2026-08-18
---

# Sounding Line v1.4.2 bootstrap receipt

## Frozen-input record

- Original protected main: `70afa7ce9f6a2c77394b96020340c069222d60f9`.
- Original protected tree: `ec4b62f9f400d2080ee7269ece27e7e8374be985`.
- Requalified protected main: `5a58cfb34696aa3f256c5a8157791dfb226ee4f0`.
- Requalified protected tree: `9d66dcede84112b6142736647f9cd5a95cb1ae2b`.
- Bootstrap branch: `codex/sounding-line-v14-2-authority-maintenance-bootstrap`.
- Product scope: none.
- Preserved Shipwright fixture: PR #194 head `a0ca41bdef9128528c9be2a0dc9bf79670a01d2e`; read-only.

## Old behavior

Against PR #194's historical merge base `c568e5aa15df4d8b682e328d97fa1a78b7b5760a`, the old classifier reached `PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_AMBIGUOUS` and `PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_UNRESOLVED`. Ordinary and verification-maintenance paths reject this bootstrap candidate because it changes authority-sensitive files; that rejection is intentional and is the recorded deadlock.

## New local behavior

The source-bound trusted-main registry resolves one `project-shipwright` descriptor, with deterministic digest and no discovery validation errors. The registration classifier admits a zero-new-contract extension only when trusted source ownership, monotonic registration data, and permitted existing contracts all agree. The authority-maintenance classifier admits this exact bounded candidate with owner authorization and rejects product paths, untrusted policy, missing authorization, stale identity, and invalid evidence.

## Local evidence

- Focused Sounding Line regression: passed (60 tests).
- Policy validation: passed.
- Documentation validation: passed.
- Scoped static/format/lint checks: passed.
- Private-content scan: passed.
- Test-registry regeneration: two consecutive runs produced the same active-registry SHA-256, `43accc66ad8eaff3f076eba194684c7103700adca87f50baa4ca6ee271229805`.

## Exception consumption and protected integration

- PR: #218, merged at 2026-08-18T17:58:57Z.
- Frozen candidate: `3fc40f12a4b11a3714f7e7cd45ae7199ada7fd74`, tree `8f35cc59bdadd4f752fcb230634537f9a2aff7fd`.
- Integrated protected main: `02dcb963cdbd7b018aa68313d35a2f569a0f5764`, tree `8f35cc59bdadd4f752fcb230634537f9a2aff7fd`.
- Normal protection attempt: workflow run `32168184938`. Record-only classification passed; verification maintenance rejected authority-changing files; authority-maintenance preflight failed with `AUTHORITY_MAINTENANCE_TRUSTED_POLICY_UNAVAILABLE`, because the trusted base did not yet contain its policy.
- Branch protection required `Sounding Line / Mainline Decision`, so the first lane installation could not produce its own required context through normal protection.
- Disposition: the single task-authorized owner bootstrap exception was consumed for that exact frozen candidate only. It did not issue `RELEASE_GO`, modify PR #194, or authorize product behavior.

Future authority-maintenance changes must use the now-protected workflow-dispatch lane and sealed protected binding. This receipt update is the bounded post-merge synthetic lane candidate; its workflow-dispatch and protected binding outcomes are recorded in its PR before any merge.

## Self-hosting recovery and normal-path proof

- Authorized recovery PR: #223, merged at 2026-08-18T18:30:28Z.
- Recovery base: `ef919af44b143d07a3584723a2dc52318a4fd09e`.
- Recovery candidate: `81a916da5ada9090f6ff147a7abf1a8300786654`, tree `2f2e7544d396caf7c1d7b17bffd6695473e79936`.
- Recovery landed main: `55ca32203481be51c23ff7b477263ff58b32bb47`, tree `2f2e7544d396caf7c1d7b17bffd6695473e79936`; the qualified and landed trees are equal.
- Rationale: the trusted workflow copies its classifier under a temporary filename. The recovery makes CLI execution filename-independent and adds a renamed-copy regression, while registry discovery deterministically prepares Prisma after a fresh install.
- Exception disposition: the separately owner-authorized #223 recovery exception was consumed for that exact base and candidate only. It did not issue `RELEASE_GO`, change product behavior, or authorize any future override.

This receipt-only change is the required tiny synthetic authority-maintenance candidate. It must obtain a real sealed plan, evidence set, finalization artifact, and protected `Sounding Line / Mainline Decision`, then merge through the normal protected path with no override.
