---
title: Voyagewright Spatial Experience Architecture v1.1 — Reach and Browser-First Interaction
audience: product-engineering
status: governing-amendment-not-implemented
canonical_for: spatial-architecture-reach-amendment-v1.1
last_reviewed: 2026-10-09
version: 1.1
---

# Voyagewright Spatial Experience Architecture v1.1 — Reach and Browser-First Interaction

## 1. Authority and exact change

This amendment extends [Spatial Experience Architecture v1.0](Voyagewright_Spatial_Experience_Architecture_Governing_Document_v1.0.md). Reach becomes a permanent owner project for reusable spatial interaction and intent. The v1.0 owner table, camera-hand integration statements, and implementation dependency model are amended only where this document explicitly changes them. All unrelated v1.0 requirements remain effective.

The effective five-domain division is Sextant (device truth), Reach (interaction intent), Landfall (world/navigation truth), Parallax (spatial entity/anchor truth), and Crossdeck (surface/transfer truth). Watchglass owns visual observations; Storytide owns narrative meaning; One Voyage owns progression. No component owns all layers merely because it renders the experience.

## 2. Observation-to-action contract

| Stage                       | Authority                                 | Output                                                 | Does not authorize              |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------ | ------------------------------- |
| Camera access and lifecycle | Sextant                                   | Lease, permission and capability state                 | Target selection                |
| Visual inference            | Watchglass or governed adapter            | Landmarks, pose/class evidence, quality and abstention | UI activation                   |
| Interaction interpretation  | Reach                                     | Calibrated target and versioned intent                 | Durable domain mutation         |
| Domain application          | Parallax, Crossdeck, Landfall or UI owner | Validated domain outcome/receipt                       | Chronicle progression by itself |
| Narrative interpretation    | Storytide                                 | Governed completion proposal                           | Direct state advance            |
| Canonical progression       | One Voyage                                | Accepted progression transition                        | Bypassing owner policy          |

Direct Crossdeck consumption of hand evidence for target/gesture interpretation is replaced by Reach intent consumption. Crossdeck still owns every handoff transaction state. Sextant's `device.gesture` means bounded hardware-motion derivation, not camera hand classification. Watchglass remains perception, not a screen-targeting or gesture-activation authority.

## 3. Browser-first rule

Core Reach pointing, highlighting, selection and constrained manipulation MUST operate inside supported browsers without a native companion. Supported means an explicitly tested configuration, not every browser/device. Inference backend, frame transfer and worker support are detected for the chosen provider. Ordinary camera inference and in-page interaction do not require system-wide capture.

Native providers MAY improve tracking or supply OS monitoring/capture. They use the same observation and intent contract and retain their own permission boundaries. A browser tab must not silently rely on external process inspection, arbitrary window control, unattended screen capture, persistent background execution, or native-only APIs. User-selected browser screen sharing remains a separate authorized capability.

## 4. Safety, accessibility and authority

Highlighting is discoverability, selection is explicit intent, manipulation is bounded preview, activation requires owner validation, and transfer is a Crossdeck transaction. Missing hands, low confidence, stale frames, timeout, and hidden tabs cannot synthesize release or completion. Every essential outcome retains a conventional accessible path.

An intent binds target/version, surface, provider generation, calibration version, operation and freshness. Owners revalidate authorization. Reach is neither authentication nor anti-cheat. Private camera/calibration evidence is not shared content. Observation simulation cannot establish physical pointing precision.

## 5. Dependency changes

Sextant camera/lifecycle foundations and a Watchglass-governed hand provider precede Reach live-camera qualification. Reach can implement its laboratory and deterministic contracts while unrelated Watchglass work remains pending. Full Watchglass completion is not a prerequisite for a bounded governed hand adapter.

Reach Phases 1–3 precede qualified general hand interaction. Crossdeck Phases 1–2 and manual handoff remain independent. Crossdeck Phase 3 Air Handoff consumes qualified Reach target selection/grip intent; Reach Phase 4 closes its Crossdeck integration only when the actual Crossdeck transaction adapter is available. Parallax and Storytide integrations similarly wait for their owner implementations, without blocking Reach's isolated laboratory.

## 6. Registries and compatibility

Existing machine-readable registries gain Reach capabilities, observation/provider relationships, non-progression events and optional surface interactions. The Reach interaction registry adds target/gesture/scenario declarations. The accepted Device Lab baseline remains 27 scenarios because its strict runtime loader does not yet accept Reach ownership. Reach scenarios are explicitly pending registration; adding them later requires an atomic loader/catalog/test update.

The v1.0 launch manifest remains historical. Its v1.1 successor records changed dependencies and current counts. Reach is governed, not implemented. Landfall's accepted Phase 4 closure and existing systems' status are preserved.

## 7. Documentation acceptance

The effective index must enumerate all new amendments, the Reach constitution, project home, current launch manifest and registry. Every changed authority link must resolve. IDs and referenced capabilities must remain consistent. No duplicate authority, unsupported numerical achievement, implementation-completion claim, or missing essential fallback may remain. Acceptance is earned through the repository's existing Sounding Line route, not a new Reach-specific publication shortcut.

## Publication and implementation boundary

This amendment is additive. Preserve the accepted baseline and all historical evidence. Its requirements become the effective documentation contract on protected-main acceptance; they do not claim new runtime implementation or passing physical qualification. Future work uses focused validation, the ordinary Sounding Line final check, protected-main integration, and a landed-tree smoke check. Sounding Line remains the software verification authority; One Voyage remains the progression authority.

The [Reach governing document](Project_Reach_Spatial_Interaction_and_Intent_System_Governing_Document_v1.0.md) defines the shared interaction contracts. The [effective spatial authority index](Voyagewright_Spatial_Experience_Effective_Authority.md) identifies the complete governing chain. Product implementation status remains explicit in the registries and project homes.
