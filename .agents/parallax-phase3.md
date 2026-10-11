---
title: Parallax Phase 3 owned implementation context
audience: automation
status: active
canonical_for: parallax-phase3-owned-context
last_reviewed: 2026-10-11
---

# Phase 3 task contract

Product-phase, UNATTENDED_CONTINUATION. Base: fetched protected main
`f458bf2dc1176016c2d166180f038f0f15ac9f7c`. Owned branch:
`codex/parallax-phase3-let-the-world-adapt`. Implement the complete §88 Phase 3
of the Parallax v1.0 governing source and its Reach v1.1 amendment.

Extend existing Studio, library, Lens, Drydock and Device Lab. Deliver typed
semantic placement, bounded multi-entity staging, stable scoped policies,
remote authoring, consented metadata calibration, meaningful search and terminal
discovery recovery, quality aggregates, executable/browser proof and documentation.
Retain historical capsules/checksums and One Voyage progression ownership.

Source packet: `src/parallax/{contracts,authoring,library-service,runtime,publication}.ts`,
Studio/Lens components, `tests/e2e/parallax-studio.spec.ts`, existing protected-media
purpose/consent service, platform Device Lab, Parallax project home and authority
§§20–24,29–31,42–43,48–60,87–88. Expand only for actual uncertainty.

No Phase 4 distributed anchors, new progression engine, pilot,
gesture expansion, recognition infrastructure or production deployment. Synthetic
screenshots precede substantial UI changes. All validation uses owned disposable
resources. Automatic imagery remains disabled without certified local screening.

The owner update in goal-objective.md on 2026-10-11 supersedes the former visual
overhaul exclusion. Reimagine the existing workstation with an independent modern
identity, dominant real 3D viewport, gizmos/cameras/snapping, visual asset browser,
resizable/collapsible docks, progressive modes and actual behavior tracks. Preserve
canonical draft/history, versions and attachment architecture. Obtain explicit
owner visual approval after actual populated desktop/constrained browser captures;
software checks alone cannot establish visual acceptance.

Owner visual approval received on 2026-10-11: "Approve this workstation experience".
It binds candidate `01de94c67ed82d0812db6f884389e0b0fc52d274`, tree
`ad973669b87803647932745f194e33be25a5670a`, the populated desktop/constrained
captures and actual pointer-gizmo/Undo evidence. Preserve this accepted design.
It does not approve Assistant A1, hardware or full Phase 3 integration.

The newer owner objective `58adf25c-0159-49e2-bd21-c0dc37c95330/goal-objective.md`
adds mandatory workspace ergonomics refinement. Preserve the approved visual
direction; implement viewport dominance, shared left-dock tabs, contextual
Inspector accordions, resizable/collapsible bottom tabs, compact/floating/docked
assistance, four coherent layouts, account-scoped presentation preferences and
real browser evidence at all six requested sizes. New refinement captures use
`artifacts/parallax-phase3/workstation-refinement/`; preserve the approved baseline.
The owner must review the resulting refinement separately. Full Phase 3 remains
required and ordinary acceptance waits for a finished frozen candidate.

## Shared implementation seams

Phase 3 owns SpatialStudio.tsx shell/editor/history, SpatialCanvas.tsx,
spatial-workstation.ts renderer, asset browser, behavior tracks, stylesheet and
adaptive/Lens lifecycle. A separate Assistant A1 task may own trusted provider,
proposal/quota/Admiralty implementation and its distinct reviewed proposal UI.
It must integrate by exact sections against accepted source, preserving this shell.
No whole-file replacement of shared Studio, contracts, API or authoring source.

Current review seam: PlacementComposer receives draft, selectedId, aiAvailable,
onPreview(SpatialDraft|null), onApply(SpatialDraft). Preview is transient and does
not save. Apply uses canonical replace -> changeHistory and existing serialized
autosave. Proposals bind exact JSON draft plus selection and reject stale apply.
SpatialCanvas accepts a preview draft and blocks edits until approve/discard.
The configured AI/critique surface retains the existing server AI action and
proposal validation; local phrase rules clearly disclose their provider-independent
nature. Assistant A1 can mount a dedicated component here without owning rendering.

Proposed broader Assistant A1 host contract (requires source reconciliation, not
yet implemented): mount its component immediately after SpatialCanvas, alongside
the existing PlacementComposer. Inputs are current immutable snapshot draft,
selectedEntityId, mode, authoritative savedRevision and a local editor-generation
token incremented by every edit/install/undo/redo. prepareBase() awaits canonical
persist(), then returns the current draft/revision/generation identity. A1 owns
strict validation/materialization of its operation bundles against that exact base;
existing narrow IntentProposal is not a substitute for the broader bundle schema.
preview({materializedDraft, affectedEntityIds, base}) only changes transient
placementPreview and renderer highlight inputs. clearPreview() removes it. Host
applyReviewed({materializedDraft, base}) rejects a changed definition, draft JSON,
selection or generation before one canonical REPLACE history edit. It never writes
directly to the library, increments the server CAS revision, bypasses autosave,
or mutates immutable releases. Async proposal responses must check the same base.
No new operation types or authoring.ts sections are admitted until A1 and Phase 3
reconcile their exact additive schemas and history/validation behavior. Quota,
provider and Admiralty services remain A1-owned. Current preview/history functions
are an available mount seam; the broader interface above is a proposal only.

### A1 interface decision: ACCEPT WITH AMENDMENTS; integration HELD

Reviewed the sibling owner's `.agents/parallax-a1-studio-interface.md`. Accept
its saved-snapshot request port, authenticated exact proposal binding,
dependency-closed operation selection, transient preview, affected-ID highlights,
canonical selection/history and shell-owned close/focus callbacks. Amend apply:

- The host returns saved draft/revision/local editor generation after serialized
  persist drains. Recheck all three after async dispatch; a digest alone cannot
  detect an intervening edit followed by Undo.
- Authenticated atomic apply returns the canonical saved draft and new revision.
  Install that acknowledgement with one canonical history replacement and mark
  it already saved. Do not issue another autosave CAS against the old revision.
  Rejects leave history unchanged. An uncertain network result retries the same
  idempotency identity before installing a result. Acknowledgement precedes success.
- Preview can select a proposed identity without changing canonical history or
  progression. Base changes, Undo and Redo clear preview/review, even when the
  draft becomes byte-identical again.
- Keep narrow IntentProposal separate from broader A1 schemas. Reconcile exact
  additive CREATE/CONTENT/BEHAVIOR/FALLBACK authoring sections and both Prisma
  schemas/migrations. Phase 3 owns resolution/field/calibration tables; A1 owns
  proposal/quota/usage tables. No whole-file imports.

The native coordinator readback confirms A1 explicitly accepted every amendment,
including monotonic editor generation, serialized persistence, atomic saved Apply,
one already-saved history installation, same-key retry and exact additive schema
ownership. Bilateral interface acknowledgement is established. Mounted integration
has cleared the owner visual prerequisite: on 2026-10-11 the owner directly
answered "Approve the refined workstation" for source
`592217e3edb214bab76373dc64cbe4b954ba3703`, tree
`36cb8d072caa7c17519d6398bd994c26c4c4a05f`. This supersedes the visual hold;
it does not certify later field/Device Lab changes or protected integration.
The canonical handoff is this owned branch after Phase 3 ordinary qualification
and protected merge. A1 may prepare against the approved source using the agreed
interfaces; mounted integration must reconcile the final protected Phase 3 tree.
No sibling source or worktree was changed.

The refined assistance host is `#parallax-assistance`, controlled by shell-owned
floating/docked presentation and close/focus state. The command bar opens it.
A1 must mount inside this host and use the agreed draft/revision/generation
callbacks without replacing dock state, canonical history or the renderer.

No cloud checks have been dispatched by this task. Local focused/browser development
checks are diagnostic. Final ordinary qualification waits for the frozen final
candidate. When only waiting for owner or CI, record SHA/tree/lock hash, commands,
owned receipts and exact resume condition; do not repeat unchanged polls.

Completion authority: focused checks → frozen candidate → ordinary product PR →
normal Sounding Line PASS → protected merge → landed smoke. Software, integration,
physical-device proof and owner experience acceptance remain distinct.
