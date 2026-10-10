---
title: Project Crossdeck v1.1 — Reach Air Handoff Intent
audience: product-engineering
status: governing-amendment-not-implemented
canonical_for: crossdeck-reach-amendment-v1.1
last_reviewed: 2026-10-09
version: 1.1
---

# Project Crossdeck v1.1 — Reach Air Handoff Intent

## 1. Authority and amended sections

This extends [Crossdeck v1.0](Project_Crossdeck_Multi_Surface_Chronicle_Experience_System_Governing_Document_v1.0.md), especially Sections 23–26, 38 and Phase 3. Reach becomes the shared selection and hand-interaction dependency. Crossdeck retains pairing, surface roles, receiver discovery, focus/custody, handoff transactions, reconnect and transfer acknowledgment.

## 2. Reusable target acquisition

Section 26's pointer/tap/highlight alternatives remain valid. Qualified calibrated pointing is an additional explicit selection path. With multiple eligible objects, Reach must show a stable unambiguous highlight before grab. Raw hand position or a canned gesture label cannot silently choose between six notes.

Reach binds the selected target/version to the interaction session. Selection does not itself open a durable transfer or change custody. Crossdeck validates the object reference, actor/source surface, allowed handoff mode and current authorization before opening its Handoff Intent.

## 3. Revised input sequence

The optional camera ceremony is enable/arm → point and highlight or conventional select → deliberate grab → carry preview → acquire/choose receiver → fresh deliberate release → Crossdeck commit → destination acknowledgment → complete source presentation.

Reach owns posture interpretation and selection/grab/release/cancel intent. Crossdeck owns every transaction state and receiver decision. Open-palm arming remains an optional discoverability cue; it cannot replace target selection or authorize a transfer. Approximate source-side hand motion is not proof of the receiving device's physical location.

## 4. Envelope and receiver authority

A handoff binds Reach interactionId, source/target surface, actor session, semantic object/version, operation mode, expiry and Crossdeck transactionId. Reach intent contains fresh observation provenance, provider generation and calibration version. Crossdeck validates freshness and transaction stage before consuming a release.

Cross-camera hand matching is not assumed. Receivers use authorized session/transaction context plus explicit readiness, qualified evidence or conventional confirmation. Ambiguous destinations require a visible choice. Network latency alone cannot choose a receiver.

## 5. Failure and transaction rules

Tracking loss, camera restart, hidden tab, stale frame, timeout and missing acknowledgment never synthesize release/success. Reach cancels or suspends input; Crossdeck applies its existing return/expiry/reconciliation policy. After an uncertain network result, query the transaction receipt before retrying. Duplicate release and acknowledgment messages remain idempotent.

Strict move semantics retain a recoverable source until destination acceptance is acknowledged. Lanternwake cannot complete departure because an animation timer ended. Unauthorized destination, changed object version or conflict returns a truthful rejection. Physical carry remains a presentation ceremony over a real transaction, not an alternative custody authority.

## 6. Dependencies and qualification

Crossdeck Phases 1–2 and manual handoff are independent of Reach. Phase 3 Air Handoff requires qualified Reach target acquisition and grip/release semantics plus an available Watchglass-governed observation provider and Sextant camera/lifecycle contracts. Reach Phase 4 closes the integration only with real Crossdeck transaction behavior.

Qualification covers wrong/ambiguous targets, receiver ambiguity, permission change, source loss, hand disappearance, stale release, duplicate messages, timeout, rejected commit and missing/late acknowledgment. D0/D1 establish state/network rules; D4/D5 establish actual gesture usability. Essential transfers always retain mouse/touch/keyboard/device-menu alternatives.

## Publication and implementation boundary

This amendment is additive. Preserve the accepted baseline and all historical evidence. Its requirements become the effective documentation contract on protected-main acceptance; they do not claim new runtime implementation or passing physical qualification. Future work uses focused validation, the ordinary Sounding Line final check, protected-main integration, and a landed-tree smoke check. Sounding Line remains the software verification authority; One Voyage remains the progression authority.

The [Reach governing document](Project_Reach_Spatial_Interaction_and_Intent_System_Governing_Document_v1.0.md) defines the shared interaction contracts. The [effective spatial authority index](Voyagewright_Spatial_Experience_Effective_Authority.md) identifies the complete governing chain. Product implementation status remains explicit in the registries and project homes.
