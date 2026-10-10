---
title: Project Watchglass Spatial Integration v1.1 — Hand Observation Providers
audience: product-engineering
status: governing-amendment-not-implemented
canonical_for: watchglass-hand-observation-amendment-v1.1
last_reviewed: 2026-10-09
version: 1.1
---

# Project Watchglass Spatial Integration v1.1 — Hand Observation Providers

## 1. Authority

This extends the scope-limited [Watchglass spatial integration v1.0](Project_Watchglass_Spatial_Perception_Integration_Amendment_v1.0.md). The full historical Watchglass constitution remains outside this integration amendment's scope. This document must be incorporated into any future full governing publication.

## 2. Provider responsibility

Watchglass owns browser/native visual hand observations, including landmarks, pose/class evidence, quality, abstention and track continuity. The provider consumes Sextant camera capability and leases. Reach consumes a versioned observation envelope; Watchglass does not select a registered UI target, decide which action is intended, or commit a manipulation/handoff.

A narrow hand provider can be implemented and qualified independently of general scene intelligence. It remains Watchglass-governed and must identify the exact model/provider version, asset digest, license, browser backend, supported hand count, frame geometry and known failure modes. Shipping that adapter does not complete Watchglass as a project.

## 3. Observation semantics

The required `HandObservation` fields and frames are frozen in Reach Sections 7–8. Track IDs are local and ephemeral. Handedness estimates are uncertain; mirrored previews do not redefine the source frame. Unknown/occluded observations remain unknown. A missing landmark or disappeared hand is never a classified release.

Canned gesture labels are posture evidence. A pointing-up classifier does not know the screen target. Model-generated world landmarks are hand-relative estimates unless calibrated otherwise; they do not establish metric camera/display geometry. Provider confidence must retain its documented meaning and not masquerade as a probability of user intent.

## 4. Scheduling and lifecycle

Worker processing uses a bounded latest-frame pipeline, explicit capture timestamps and provider generations. Late results from an old camera/model generation are invalid. Loss of permission/lease or tab suspension requires an abstention/lifecycle boundary, not optimistic extrapolation.

Inference acceleration is provider-specific and tested. Do not promise WebGPU support merely because a browser exposes WebGPU. If an approved provider fails to initialize, return unavailable/degraded with conventional alternatives. Do not upload frames to a remote recognizer silently.

## 5. Privacy and qualification

Local inference is the default. Footage recording/export requires separate consent and protected evidence handling. No biometric identity or cross-camera universal hand identity is claimed. A bystander hand must not become authorization to operate an account or acquire a target.

Provider tests cover lighting, occlusion, handedness, frame mirroring, dropped/out-of-order frames, track swaps, multiple hands, worker/model failures and cleanup. D0/D1 prove contract handling; real webcam qualification is required for claims about tracking quality. Reach owns pointing/selection metrics; Watchglass owns observation fidelity and abstention evidence. Both must retain failed trials and explicit limitations.

## 6. Changed Crossdeck seam

Earlier descriptions of Crossdeck consuming palm/fist/release evidence remain historical. New general hand interaction must flow through Reach's stateful intent contract. Crossdeck may receive bounded provenance references but must not establish a second selection/calibration/gesture engine. Manual transfer continues when hand observation is absent or unqualified.

## Publication and implementation boundary

This amendment is additive. Preserve the accepted baseline and all historical evidence. Its requirements become the effective documentation contract on protected-main acceptance; they do not claim new runtime implementation or passing physical qualification. Future work uses focused validation, the ordinary Sounding Line final check, protected-main integration, and a landed-tree smoke check. Sounding Line remains the software verification authority; One Voyage remains the progression authority.

The [Reach governing document](Project_Reach_Spatial_Interaction_and_Intent_System_Governing_Document_v1.0.md) defines the shared interaction contracts. The [effective spatial authority index](Voyagewright_Spatial_Experience_Effective_Authority.md) identifies the complete governing chain. Product implementation status remains explicit in the registries and project homes.
