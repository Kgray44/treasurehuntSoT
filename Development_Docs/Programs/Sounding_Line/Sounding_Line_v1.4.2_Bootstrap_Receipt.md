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

## Integration control

This receipt is local qualification evidence, not protected-main acceptance. Before the one-time bootstrap exception can be consumed, freeze and record the candidate SHA/tree, create a bounded PR, inspect its exact diff, and attempt the normal protected path. If the absent lane is the sole reason branch protection cannot produce its required check, the repository owner may use the single authorized override. After merge, update this receipt with the protected main SHA/tree, PR, exception disposition, branch-protection proof, and synthetic landed-lane self-check.
