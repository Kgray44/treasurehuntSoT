---
title: Sounding Line v1.4.2 Trusted Project and Registration Admission Record
audience: engineering
status: current
canonical_for: sounding-line-v1.4.2-trusted-project-registration-admission
last_reviewed: 2026-08-18
---

# Sounding Line v1.4.2 trusted project and registration admission

## Root cause and correction

The previous registration classifier could only identify a product owner from exactly one newly introduced contract authority. That rejected a safe verification-only extension which exercised accepted contracts, and it had no trusted identity for Project Shipwright despite the protected-main Phase 1/2 record, Feature Catalog evidence, Creator Studio source, and browser evidence.

`testing/trusted-project-discovery.json` is now a narrow, protected-main-only registry. `scripts/sounding-line/project-discovery.mjs` binds every descriptor to the exact protected-main SHA/tree, requires each evidence and source/test relationship to exist in that tree, emits a deterministic digest, and rejects broad source roots. It contains the initial `project-shipwright` descriptor with aliases `Shipwright` and `Project Shipwright`, documentation root `Development_Docs/Projects/Project Shipwright/**`, bounded Creator Studio ownership, and only the already accepted supporting owners required for shared contract verification.

The registry is not candidate authority. It is loaded from the trusted base; a candidate that edits ownership or the discovery registry is rejected. Candidate-derived discovery remains provisional and may not narrow authority.

## Registration rule

`PRODUCT_WITH_VERIFICATION_REGISTRATION` now resolves one trusted primary owner from protected-main ownership or a trusted discovery descriptor and requires a real owned product-source change.

- One new contract authority remains valid only when it equals that primary owner.
- Zero new contract authorities is valid when the addition is monotonic, each new owned suite/case/config/impact edge uses an existing primary-owner contract or an explicit trusted supporting-owner contract, and no ownership, contract, suite, mapping, disposition, or foreign evidence is mutated or removed.
- Multiple new authorities, no unique owner, conflicting owners, candidate-owned discovery, foreign contract mutation, unowned contracts, and deleted suites fail closed.

Drydock remains the authoring-contract and validation authority. One Voyage remains Chronicle/runtime authority. Project Shipwright is limited to the Creator authoring experience; it gains no blanket `src/**`, `src/components/**`, API, or arbitrary-script ownership.

## Regression and boundary

The preserved PR #194 head `a0ca41bdef9128528c9be2a0dc9bf79670a01d2e` was fetched and inspected read-only. Against its historical base `c568e5aa15df4d8b682e328d97fa1a78b7b5760a`, the old trusted classifier reported `PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_AMBIGUOUS` and `PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_UNRESOLVED`. The branch is untouched. Its current mergeability and any new unrelated registration errors remain separate from this platform correction.

The focused regression matrix covers deterministic trusted identity, provisional candidate discovery, protected Sounding Line paths, bare-script non-admission, zero-contract registration, foreign registration and contract failures, suite deletion, unowned-contract failure, one new-contract success, and multi-owner failure.

## Release boundary

Ordinary product candidates still require `RELEASE_GO`. This correction does not issue release authority, change product behavior, modify PR #194, or start Shipwright Phase 4.
