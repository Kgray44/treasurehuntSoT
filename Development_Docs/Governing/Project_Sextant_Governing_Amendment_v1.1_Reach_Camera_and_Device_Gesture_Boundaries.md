---
title: Project Sextant v1.1 — Reach Camera and Device Gesture Boundaries
audience: product-engineering
status: governing-amendment-not-implemented
canonical_for: sextant-reach-amendment-v1.1
last_reviewed: 2026-10-09
version: 1.1
---

# Project Sextant v1.1 — Reach Camera and Device Gesture Boundaries

## 1. Authority and affected baseline

This amendment extends [Sextant v1.0](Project_Sextant_Device_Context_and_Hardware_Capability_System_Governing_Document_v1.0.md), particularly device gesture derivation, camera context, lifecycle and consumer contracts. It does not remove Sextant's accepted hardware-motion design or transfer camera ownership to Reach.

## 2. Device gestures versus visual interaction

`device.gesture` and `DEVICE_GESTURE_COMPLETED` refer to bounded derivations from hardware/device-motion observations: deliberate phone rotation, tilt bands, stable hold or supported motion semantics. They exclude visual hand landmarks, index-finger target estimation, pinch selection, fist/release interaction grammar and wrist-driven target manipulation.

Visual hand evidence belongs to Watchglass. Reach interprets that evidence into user interaction intent. Phone rotation derived by Sextant may remain a useful observation consumed by Reach or Storytide, but observing motion does not directly activate a UI object or advance a Chronicle.

## 3. Camera contract

Sextant exposes support, availability, permission, lease, generation, source geometry and foreground lifecycle independently. Watchglass's hand provider consumes the camera lease; Reach consumes its observation envelope and capability status. Compatible consumers may share a lease only under an explicit acquisition/lifecycle policy. No project silently opens a second competing stream.

Permission revocation, track end, camera switch, source geometry changes, background suspension and thermal/resource limits must reach the provider and Reach promptly. Camera/device changes invalidate corresponding calibration. Resource release must stop the tracks owned by the released lease without stopping another valid consumer's shared resource.

## 4. Consumer and native-provider limits

Reach is a consumer of device capability discovery, permission state, camera capability, lifecycle and power/thermal context. These consumer relationships do not make Sextant the general interaction engine. Native camera/hand hardware can supply a governed provider but must retain the same observation provenance and runtime capability semantics.

The browser baseline must remain useful without external process monitoring, OS capture or native camera helpers. Unavailable specialized hardware produces a clear fallback, not a fabricated capability. Camera permission does not imply microphone or screen-capture permission.

## 5. Required evidence and migration

Tests must distinguish camera permission granted but busy, permission revoke mid-hold, camera-source switch, shared-lease cleanup, background/foreground reset and provider-generation invalidation. Hardware-motion regression tests retain the existing device-gesture meanings. No prior hardware receipt is relabeled as proof of camera pointing.

Future implementation audits existing direct consumers and migrates general visual interaction to Reach adapters. Until that migration is implemented, documentation must identify the compatibility seam honestly. No private raw sensor or calibration data is added to consumer events merely to make targeting easier.

## Publication and implementation boundary

This amendment is additive. Preserve the accepted baseline and all historical evidence. Its requirements become the effective documentation contract on protected-main acceptance; they do not claim new runtime implementation or passing physical qualification. Future work uses focused validation, the ordinary Sounding Line final check, protected-main integration, and a landed-tree smoke check. Sounding Line remains the software verification authority; One Voyage remains the progression authority.

The [Reach governing document](Project_Reach_Spatial_Interaction_and_Intent_System_Governing_Document_v1.0.md) defines the shared interaction contracts. The [effective spatial authority index](Voyagewright_Spatial_Experience_Effective_Authority.md) identifies the complete governing chain. Product implementation status remains explicit in the registries and project homes.
