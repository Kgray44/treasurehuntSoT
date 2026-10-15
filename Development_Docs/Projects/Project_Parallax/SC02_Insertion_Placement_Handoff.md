---
title: SC-02 physical insertion placement helper handoff
audience: product-engineering
status: in-qualification
canonical_for: parallax-sc02-physical-insertion-helper
last_reviewed: 2026-10-15
---

# Physical insertion placement handoff

The combined Studio candidate `e073eaa29f71965c316b459d4f9f08773232c9d6` retains `insertOne` coordinates from the earlier showcase. For the 0.86 m deep sofa, `z = 1.5 + depth / 2` places the far edge at 2.36 m in Bedroom's 4 m deep room, beyond its 2 m boundary. The fixed table and wall coordinates likewise do not resolve the currently selected Environment.

Source/test commit `d489a649f0188d49737c49e01d6e9e5f2cee6143` adds only `src/parallax/element-insertion-placement.ts` and its test file, directly on that combined candidate. The original SC-02 checkout, source, captures, independent reviews and counters remain unchanged. This is an unwired helper handoff to the existing Studio integration owner; it does not change current application behavior or establish rendered acceptance.

## Contract and placement authority

`planPhysicalAssetInsertion({ draft, modelId, environment, preferredPosition? })` returns either `PLACED { surfaceId, transform }` or `NO_FIT { reason, message }`. It never inserts, changes a draft, writes storage or selects a different Environment. Pass the exact current `PreviewEnvironment`; an unknown identifier without authored features returns `ROOM_REQUIRED`, and an explicitly empty feature list remains empty.

The helper uses the existing `syntheticRoomGeometry`, `discoverRoomSurfaces`, `surfaceFrameRotation` and `findSurfacePlacement` authorities. An internal affine conversion of the support plane adapts an exact rectangular footprint to the existing solver's 4:3 footprint; the real room and candidates remain unchanged. Floor models require a floor, table models a table/desk, and wall models a vertical wall. Existing blocked contexts, window/door exclusions, occlusion and canonical minimum-clearance threshold remain enforced.

Full-height obstruction projections include room-part volumes and authored physical/legacy solids at their canonical preview transforms. This covers overhead objects beyond the discovery clearance slice. Hidden solids remain conservatively occupied. Curved/complex parts use enclosing bounds, so an unproved fit may be refused. Returned transforms retain unit scale and a bottom-center Y-up model pivot; wall thickness is separated from the wall face. `preferredPosition` describes the desired support-face footprint center.

## Host integration

The Studio owner must resolve the exact current preview and draft, compute a plan, and apply its world transform through the existing canonical frame/history operation. A `NO_FIT` result must preserve the current draft and show its recovery message. Do not catch it and fall back to the old hardcoded coordinates. This module deliberately does not edit Studio, Canvas, the renderer, the existing placement engine or canonical persistence.

The API plans one physical model at its rest dimensions. It does not plan non-solid effects, imported arbitrary geometry or a multi-solid composition as a whole. A composition needs an independently checked rigid group plan; one constituent's fit cannot prove the others fit. Existing open articulation returns `OPEN_ARTICULATION` with manual recovery because its expanded collision bounds are not qualified here. Adaptive Scenes retain the existing semantic resolver. No automatic shrinking, alternate yaw search, exhaustive packing, animation collision avoidance or physical safety is claimed.

After wiring into combined source, the integration owner must capture/review actual Bedroom floor insertion, table and wall insertion, occupied/no-fit/manual recovery, canonical Undo/save/reload and the applicable responsive journeys. Earlier product receipts remain source-bound historical evidence. Full consumer, trusted capture/review, protected integration and owner acceptance remain separate.

## Development evidence

The [receipt manifest](evidence/sc02/insertion-placement-handoff-01/verification.json) preserves source identities and raw output hashes. The focused run passes **50 tests in two files**: 42 new helper cases and eight existing room-geometry cases. Coverage includes the original Bedroom overflow, all 30 model descriptors' bounded outcomes, raised/rotated support, window openings, occupied solids, full-height obstacles, absent geometry/support, low clearance and explicit manual recovery. Focused TypeScript, lint and formatting checks pass. No actual browser capture, significant experience acceptance, ordinary qualification or merge is claimed by these checks.

Documentation indexing initially hit the inherited generator's default 1 MiB subprocess buffer: the complete Git inventory is 1,193,372 characters across 11,723 paths. The unchanged generator and documentation validator pass with an ignored, process-local Node preload raising only Git's output buffer to 16 MiB. It neither filters output nor changes validation rules. The first failed output remains in the owned checkout's artifacts. The integration owner should regenerate indexes against its actual combined candidate; this handoff's generated index also includes previously unindexed records inherited from `e073eaa2`.

Product status, the Creator guide and feature governance were reviewed: this unwired correction does not promote SC-02 availability or a completed feature. The completed-feature fragment remains unchanged.
