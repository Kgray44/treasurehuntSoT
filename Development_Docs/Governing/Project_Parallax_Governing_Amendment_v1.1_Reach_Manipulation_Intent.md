---
title: Project Parallax v1.1 — Reach Manipulation Intent
audience: product-engineering
status: governing-amendment-not-implemented
canonical_for: parallax-reach-amendment-v1.1
last_reviewed: 2026-10-09
version: 1.1
---

# Project Parallax v1.1 — Reach Manipulation Intent

## 1. Authority and scope

This extends [Parallax v1.0](Project_Parallax_Spatial_Chronicle_and_Augmented_Reality_System_Governing_Document_v1.0.md) for input interpretation and spatial manipulation. Parallax retains all scene/entity/anchor truth, adaptive placement, spatial constraints and shared-scene authority. Reach does not become an AR engine.

## 2. Entity adapters

An eligible entity registers a Reach target bound to entity/version, surface, permitted operations, hit geometry epoch, visibility/access policy, degrees of freedom, translation/rotation/scale limits, feedback and conventional alternatives. The adapter exposes authorized visible geometry only. Hidden entities and private crew content are not discoverable through target snapping.

Reach may emit relative manipulation deltas in a declared target frame. Parallax converts them through its scene/anchor transforms, applies constraints, checks current entity version and interaction custody, and returns accepted/rejected outcomes. Reach cannot directly write anchors or shared authoritative transforms.

## 3. Screen and spatial modes

Screen-space artifact inspection, approximate wrist orientation control, device-space manipulation and metric world-space tracking have separate capability claims. An RGB wrist estimate may rotate a view convincingly without qualifying six-degree-of-freedom pose or physical placement accuracy. No adapter may promote one into the other silently.

DOM/CSS and renderer pick geometry must be converted explicitly. Depth/occlusion ranking remains Parallax-owned scene truth. Reach ranks eligible interactive candidates and abstains when uncertainty cannot distinguish them. World-anchored objects do not detach automatically to simplify camera gestures.

## 4. Preview, commit and recovery

Begin acquires a bounded session and reference transform. Update requests a preview delta. End proposes the owner-approved result; cancel restores or retains the owner-defined safe state. Live persisted manipulation is allowed only through an explicit owner contract with version/conflict rules.

Hand loss freezes/cancels, never commits. Recovery establishes a new relative reference without a jump. Quaternion normalization, degenerate-axis rejection, hand-crossing behavior and min/max scale are tested. Visual inertia is presentation; it cannot satisfy a narrative completion condition by itself.

## 5. Shared and cross-surface interactions

Parallax resolves simultaneous actor conflicts and shared-scene leases. Reach cannot override another actor's custody. Crossdeck owns transfer of presentation/interaction custody to another surface; Parallax owns representation and scene constraints before and after the transfer. Object identity remains stable and authorization is revalidated at the destination.

## 6. Acceptance

Required tests cover constrained transforms, target invalidation, anchor-frame conversion, hidden/occluded targets, competing input, simultaneous actors, stale intent, tracking loss, recovery continuity and reset. Physical tracking evidence is required only for physical claims and cannot be inferred from deterministic renderer tests. Conventional artifact controls remain available. A mocked adapter does not close the live Parallax integration gate.

## Publication and implementation boundary

This amendment is additive. Preserve the accepted baseline and all historical evidence. Its requirements become the effective documentation contract on protected-main acceptance; they do not claim new runtime implementation or passing physical qualification. Future work uses focused validation, the ordinary Sounding Line final check, protected-main integration, and a landed-tree smoke check. Sounding Line remains the software verification authority; One Voyage remains the progression authority.

The [Reach governing document](Project_Reach_Spatial_Interaction_and_Intent_System_Governing_Document_v1.0.md) defines the shared interaction contracts. The [effective spatial authority index](Voyagewright_Spatial_Experience_Effective_Authority.md) identifies the complete governing chain. Product implementation status remains explicit in the registries and project homes.
