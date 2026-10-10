---
title: Sounding Line Device Lab Annex v1.1 — Reach Qualification
audience: product-engineering
status: governing-amendment-not-implemented
canonical_for: device-lab-reach-annex-v1.1
last_reviewed: 2026-10-09
version: 1.1
---

# Sounding Line Device Lab Annex v1.1 — Reach Qualification

## 1. Authority and unchanged release policy

This adds Reach qualification to the [Device Lab annex v1.0](Project_Sounding_Line_Voyagewright_Device_Lab_Governing_Annex_v1.0.md). It does not change Sounding Line's effective version, machine authority index, required Mainline Decision context or release semantics. Projects own behavior/oracles; Sounding Line owns execution policy, isolation, evidence fidelity, cleanup and software acceptance.

## 2. Declaration versus registration

Reach scenario declarations live in the separate Reach interaction registry. The accepted shared loader has a fixed owner enum and a 27-scenario baseline, so this documentation task does not alter that runtime-coupled baseline. A future implementation must atomically extend owner vocabulary, scenario schemas/catalog, pack registration and regression tests before executing Reach packs.

Declared scenarios remain `NOT_YET_REGISTERED_UNTIL_IMPLEMENTATION`, with no executable adapters or passing receipts claimed. Missing registration is a blocking implementation requirement, not a permanent waiver. Registration must resolve all capability IDs and enforce Reach scenario/oracle ownership.

## 3. Evidence tier obligations

D0 tests schema/state/geometry/fault invariants deterministically. D1 tests browser permission, viewport, worker and input integration under emulation. D4 tests actual camera/hand tracking and controlled physical pointing/manipulation. D5 tests realistic placement, environmental variation, ergonomics and mixed-input use. D2/D3 apply only to a genuinely available provider/runtime.

Virtual cameras, prerecorded fixtures and synthetic landmarks do not qualify natural pointing accuracy. Live physical evidence begins in Reach Phase 1 and is mandatory for Phase 2 acquisition qualification. D5 is mandatory for final usability claims. Reports retain pending gates rather than promoting a lower-tier pass to physical proof.

## 4. Measurement protocol

Bind exact source, provider/model digest, calibration/mapping version, target/gesture definitions, settings, browser/device, camera geometry class, mode, tier and scenario. Preserve training/validation separation. Report raw and snapped error separately, p95 latency/jitter, successful acquisition, false activation opportunity count, tracking failures, cancellations and recovery continuity.

Qualification uses Reach Section 27's initial gates and versioned reference setup. Report per-participant results, sampling limitations, failed trials and excluded-sample reasons. A latency measured only between worker output and animation is not complete camera-to-visible latency; name instrumentation uncertainty. Do not silently lower gates to create a green receipt.

## 5. Fault, privacy and cleanup coverage

Required faults include stale/out-of-order frames, mirror/epoch mismatch, camera switch, provider restart, hand identity swap, occlusion, browser hide/freeze, permission revocation, modal/keyboard input conflict and Crossdeck release/ack interruption. Every loss/timeout fixture asserts no unintended activation or transfer commit.

Record footage only with separate consent. Protected evidence uses existing owner policies; public reports contain bounded metrics and sanitized setup information. Cleanup proves no owned tracks, workers, timers or leases remain and must preserve compatible shared consumers. Physical evidence must identify its actual tier/provenance and never reuse historical Landfall receipts under a Reach label.

## 6. Mainline boundary

Documentation acceptance checks authority links, registry consistency, implementation-state truth and existing Device Lab compatibility. It does not run nonexistent Reach product suites or create physical qualification. Later phase PRs register meaningful focused proof and use the ordinary Sounding Line final check once ready. A new Reach-specific release authority is prohibited.

## Publication and implementation boundary

This amendment is additive. Preserve the accepted baseline and all historical evidence. Its requirements become the effective documentation contract on protected-main acceptance; they do not claim new runtime implementation or passing physical qualification. Future work uses focused validation, the ordinary Sounding Line final check, protected-main integration, and a landed-tree smoke check. Sounding Line remains the software verification authority; One Voyage remains the progression authority.

The [Reach governing document](Project_Reach_Spatial_Interaction_and_Intent_System_Governing_Document_v1.0.md) defines the shared interaction contracts. The [effective spatial authority index](Voyagewright_Spatial_Experience_Effective_Authority.md) identifies the complete governing chain. Product implementation status remains explicit in the registries and project homes.
