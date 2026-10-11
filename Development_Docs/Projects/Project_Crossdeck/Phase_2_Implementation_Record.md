---
title: Crossdeck Phase 2 implementation and qualification record
audience: product-engineering
status: local-qualification
canonical_for: crossdeck-phase2-implementation
last_reviewed: 2026-10-11
---

# Phase 2 — Keep One Deck

This isolated candidate implements Crossdeck v1.0 §64 Phase 2 on protected baseline `2e367c372a6d44e4e6a68bb38266196954f8d486`. The Reach v1.1 amendment remains effective: calibrated intent is Reach-owned; this candidate implements manual destination selection, without gesture recognition, spatial targeting or Reach source dependencies. No publication, merge or deployment is authorized.

## Player path

Pair desktop and phone through the existing **Devices** panel using the same Wayfarer person and Voyage. In the Journal, open **Send to...**, choose a device and how the released map, note or artifact should open, then choose **Send view**. The destination explicitly chooses **Receive**. Notes require a private-content confirmation. All controls support keyboard input and ordinary reduced-motion rendering.

**Continue there** moves focus and custody; the source retains its view until the destination opens and acknowledges. **Control there** moves custody and leaves a source mirror after acknowledgement. **Mirror view**, **Open companion**, and **Keep on that device** retain source custody and follow its context. **Send read-only view** freezes the accepted context. Closing a companion closes only that representation; closing the controlling representation clears its deck presentation, never canonical content. Preferred destinations are per-family presentation preferences, not permissions.

If a receiver is unavailable before commit, the invitation expires and the source retains custody. A committed transfer has a distinct pending acknowledgement receipt and remains recoverable. When its controlling device is disconnected, locked or stale, another authorized personal surface can explicitly **Recover view here**. Rejoining devices read the durable winning custody rather than replaying obsolete intent. The client retains one uncertain request for exact retry; it never invents a successful receipt or queues progression offline.

Crew displays use `/devices/display?voyage=<id>` and the sponsoring canonical AccountSession, with the exact Voyage bound. Only pinned content declaring `configuration.crossdeck.visibility: "CREW"` is eligible. They receive authorized reading text and released Landfall geometry; they cannot acquire custody or send, and private notes fail closed. Ordinary personal Journal routes retain their own authority, independent of the crew route. Revocation denies every server operation immediately; visible clients clear sensitive presentation on failed refresh. Browser scheduling limits visible propagation latency.

## Requirement-to-evidence mapping

| Phase obligation              | Implementation                                                                                                                   | Proof                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Sync transport and routing    | `src/crossdeck/transport.ts`, authenticated no-store sync/view routes; 500 ms single-flight snapshots with bounded retry backoff | Transport/API tests and desktop/mobile browser scenarios                        |
| Focus, custody, six modes     | `sync-contracts.ts`, `sync-service.ts`, Journal handoff controls                                                                 | Real Prisma service tests, mode/frozen-context/conflict assertions              |
| Manual Send to                | Journal toolbar, active-device selector, explicit receive and note consent                                                       | Keyboard browser journey and scoped Axe audit                                   |
| Map/note/artifact continuity  | Pinned canonical object/version resolver, bounded semantic context, Journal block/reading restoration and Landfall bridge        | Three-family service tests; browser map/worldspace handoff                      |
| Ordering, replay and conflict | Server-bound actor/time, monotonic per-surface sequence, UUID/hash replay ledger, durable deck revision compare-and-swap         | Replay, altered-request, stale-revision and two-service race tests              |
| Reconnect/stale recovery      | Live parent/membership authorization, offer expiry, pending acknowledgement and explicit recovery                                | Loss/lock/stale/late-ack/revocation tests and phone-disconnect browser scenario |
| Shared display                | Explicit immutable crew policy and approved projection; no story controls or personal auto-route                                 | Crew/privacy service and view-route tests                                       |
| One Voyage invariant          | Crossdeck writes only participation and deck presentation                                                                        | D0/D1 identity, membership, event and sequence cardinality assertions           |
| D0–D2                         | Existing shared Device Lab scenarios with Phase 2 owner packs                                                                    | Permanent source-bound receipts; unsupported tiers reported without promotion   |

## Durable state and integration seams

One additive `CrossdeckDeck` row belongs to the existing `PlaythroughMembership`. JSON contains bounded presentation and handoff metadata, not copied Chronicle text, account credentials, raw sensors or progression. Both datamodels retain existing Device Lab/Sextant contracts. SQLite and MySQL migrations use the independent name `20261011_0001_crossdeck_phase2`; reconcile that reservation before integration with concurrent branches. SQLite execution and MySQL static DDL verification are separate from a live MySQL migration gate.

The shared changes are additions to `testing/contracts.json`, `testing/suites.json`, `testing/impact-map.json`, both Prisma schemas and the Journal/Landfall presentation seams. No dependency, package-script, Device Lab registry/schema, Sextant provider, Parallax entity/anchor, Drydock catalog, or Reach implementation is changed. Parent messaging was unavailable from this task (`thread not found`); these overlaps must be reconciled before integration rather than consuming another task's unmerged source.

## Qualification and acceptance

The permanent evidence directory records the exact software fidelity and source identity. D0 executes deterministic synthetic service/database scenarios. D1 uses two production-route Chromium contexts with mobile emulation. D2 requires an actual task-owned Android virtual device and Android Chrome; `scripts/crossdeck/qualify-d2.ts` validates its platform or emits UNSUPPORTED receipts. It does not label browser emulation as Android evidence.

D2, live MySQL, protected-main integration, the owner walkthrough and physical/field qualification remain distinct gates until their own evidence exists. An unavailable emulator is an environmental qualification blocker, not permission to omit the scenario or declare Phase 2 accepted. Air Handoff, rich Parallax/Storytide choreography, full offline synchronization and physical D4/D5 closure remain their governed later phases.

Feature Catalog: NO CHANGE REQUIRED — the completed-feature catalog excludes unaccepted branches; Phase 2 has an outstanding D2 gate. The existing Phase 1 mainline entry remains truthful about its accepted scope.

## Task binding

Request marker: `ld-Sentinel_ced57a02aaf0819185ccbb151fe64653-crossdeck-p2`. Native title and request content were independently read back as **Crossdeck Phase 2: Keep One Deck**. The supplied VoyageWright project ID resolves to the source project, but this task's durable metadata returned project association `null`; native Goal read/write is unavailable. These metadata limitations do not replace implementation or qualification obligations. The manually prepared context packet is `.agents/crossdeck-phase2.md`; it is not fabricated Launchdeck helper output.
