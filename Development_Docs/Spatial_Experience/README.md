---
title: Spatial Experience registry guide
audience: product-engineering
status: governing-not-implemented
canonical_for: spatial-registry-guide
last_reviewed: 2026-10-09
---

# Spatial Experience registry guide

These are machine-readable projections of the [effective additive governing chain](../Governing/Voyagewright_Spatial_Experience_Effective_Authority.md). They do not replace governing prose, register executable tests or claim runtime implementation.

| Registry                                                               | Current record count |
| ---------------------------------------------------------------------- | -------------------- |
| [spatial-capability-ownership.json](spatial-capability-ownership.json) | 55                   |
| [device-capability-registry.json](device-capability-registry.json)     | 23                   |
| [spatial-provider-registry.json](spatial-provider-registry.json)       | 18                   |
| [surface-capability-registry.json](surface-capability-registry.json)   | 10                   |
| [spatial-event-registry.json](spatial-event-registry.json)             | 63                   |
| [device-lab-scenario-registry.json](device-lab-scenario-registry.json) | 44                   |
| [reach-interaction-registry.json](reach-interaction-registry.json)     | 17                   |

The Device Lab catalog retains the 27 original declarations, nine Sextant Phase 1 additions, and eight Parallax Phase 1 D0 additions (44 total). Executable owner packs and source-bound receipts establish passing evidence; catalog declarations alone do not. Reach's 17 scenarios are separate pending declarations because the current strict loader excludes Reach ownership. Phase 1 implementation must atomically extend the shared owner/catalog/test boundary before registering Reach packs. Do not import the new Reach registry into current production runtime or count its declarations as passing evidence.

`device.gesture` remains Sextant hardware-motion derivation. `perception.hand-observation` belongs to Watchglass. `interaction.*` belongs to Reach. `surface.handoff` belongs to Crossdeck. Reach events are non-progression intent; One Voyage alone owns canonical progression.

Validate unique IDs, authority paths, all referenced semantic/provider/capability IDs, D0–D5 tier membership, scenario/oracle ownership, declaration status, conventional fallbacks and unchanged accepted baseline compatibility. The [Launch Manifest v1.1](../Programs/Spatial_Experience/Voyagewright_Spatial_Experience_Wave_4_Implementation_Launch_Manifest_v1.1_Reach.md) describes dependencies and implementation entry.
