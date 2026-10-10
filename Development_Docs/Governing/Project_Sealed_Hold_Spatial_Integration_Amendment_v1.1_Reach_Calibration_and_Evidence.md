---
title: Project Sealed Hold Spatial Integration v1.1 — Reach Calibration and Evidence
audience: product-engineering
status: governing-amendment-not-implemented
canonical_for: sealed-hold-reach-amendment-v1.1
last_reviewed: 2026-10-09
version: 1.1
---

# Project Sealed Hold Spatial Integration v1.1 — Reach Calibration and Evidence

## 1. Authority

This extends the [Sealed Hold spatial media/calibration integration record v1.0](Project_Sealed_Hold_Spatial_Media_and_Calibration_Evidence_Integration_Record_v1.0.md). It clarifies Reach's private calibration and optional recorded evidence without changing accepted encryption, authorization or retention authority.

## 2. Private data classification

Reach calibration fits, camera/display binding metadata, hand sequences, raw footage and identifiable room/bystander imagery are private runtime/evidence data. Local-only calibration is preferred and does not require an upload. Any persistence/synchronization or evidence export uses explicit purpose, authorization, expiry/retention, deletion and existing protected-storage rules.

A camera grant is not consent to record or upload. Evidence recording is separately enabled and clearly visible. Public analytics/reporting uses bounded aggregate metrics and sanitized setup information, not landmarks, private calibration vectors or hidden target names.

## 3. Access and lifecycle

Bind calibration to the correct user/device/provider context and prevent automatic crew sharing. Reuse requires validation; deletion invalidates derived personalization. Shared protected evidence uses existing verified access rules. Public Community content, Harborlight packages and ordinary logs cannot contain these private artifacts.

Provider/interaction shutdown stops future collection and releases resources. Previously retained consented evidence follows its owner retention/deletion policy; do not claim deletion of immutable accepted evidence without the existing policy's semantics. Reach is not a biometric authentication store.

## 4. Qualification

Tests cover unauthorized cross-user access, export consent, local versus uploaded data, deletion/invalidation, log sanitization, bystander handling and public-package exclusion. Synthetic evidence remains labeled synthetic. A protected test recording cannot become a reusable public model-training asset through an incidental export path.

## Publication and implementation boundary

This amendment is additive. Preserve the accepted baseline and all historical evidence. Its requirements become the effective documentation contract on protected-main acceptance; they do not claim new runtime implementation or passing physical qualification. Future work uses focused validation, the ordinary Sounding Line final check, protected-main integration, and a landed-tree smoke check. Sounding Line remains the software verification authority; One Voyage remains the progression authority.

The [Reach governing document](Project_Reach_Spatial_Interaction_and_Intent_System_Governing_Document_v1.0.md) defines the shared interaction contracts. The [effective spatial authority index](Voyagewright_Spatial_Experience_Effective_Authority.md) identifies the complete governing chain. Product implementation status remains explicit in the registries and project homes.
