# A1 proposed additive Studio interface

Status: ACCEPTED WITH PHASE 3 AMENDMENTS, shared integration HELD. No Phase 3 checkout changes are authorized. Phase 3 owns shell, renderer, camera/gizmos, inspector, hierarchy/library/timeline/editor state and adaptive logic. A1 owns the isolated Assistant, provider/proposal service and durable quota/Admiralty modules. Provisional A1 `authoring.ts` additions are CREATE/CONTENT/BEHAVIOR/FALLBACK commands only; reconcile with Phase 3's canonical authoring after the accepted source and interface agreement are available.

The independent Assistant receives current `draft`, numeric saved `revision`, monotonic local `editorGeneration`, `selectedEntityId`, account-scoped usage and an asynchronous `request` port. Its `prepareBase` port awaits the serialized canonical persist queue and returns the exact saved snapshot/revision/local editor generation. Every edit, canonical install, Undo and Redo increments that generation; the Assistant rechecks all three after dispatch and validation, including an edit followed by Undo to byte-identical content. Network dispatch uses the existing authenticated/CSRF-protected `/api/studio/parallax` AI action with an additive ASSISTANT kind, bounded request metadata and idempotency identity; no second paid inference endpoint.

Agreed mount callbacks (independent A1 component implements its side only):

- `onPreview(next: SpatialDraft | null, affectedEntityIds: readonly string[])`: place the validated proposed content in the real preview seam (Phase 3 placementPreview/setPlacementPreview or its accepted successor) and highlight exact affected identities. Manual changes clear preview and stale review. Preview does not replace `history.present` or persist.
- `port.apply(proposal, selectedOperationIds, idempotencyKey)`: authenticated atomic apply rechecks current owned saved scene/revision against the retained canonical proposal, then returns `{ status: "SAVED", draft, revision }`. The Phase 3 host installs that acknowledged canonical draft through ONE history replacement marked already saved, and resolves only after installation. No duplicate autosave CAS against the old revision; no second history implementation. Rejections leave history unchanged. Uncertain network outcomes retry the same idempotency identity before installation. The Assistant verifies the acknowledged draft and next revision before reporting acceptance. Backend Apply and host installation are now implemented against accepted Phase 3 source; complete browser qualification remains pending.

- `onSelect(entityId: string)`: focus/select a current or proposed object using the renderer's accepted selection contract.
- `onUndo()` / `onRedo()`: existing history authority; callbacks expose actual success feedback and clear pending proposal preview.
- `onClose()` / optional `onCanvasView()`: shell-owned mobile canvas/panel switching and focus restoration. The Assistant component owns only its composer/review state and resize preference.

Server proposal identity: schemaVersion 1, requestId, definitionId, sceneRevision, editorGeneration, SHA-256 sceneDigest over parsed complete draft. Interpretation maps only validated operations; no broad model-owned replacement. Review selects dependency-closed independent operations, materializes through ordinary canonical commands and sends exact proposal binding plus selected IDs for authenticated atomic apply. Stored owner-scoped provider results supply canonical proposal authority; clients cannot invent accepted proposals.

Observed relay checkpoint: Phase 3 candidate `abacc30d` has workstation/adaptive browser PASS; those are Phase 3's claims, not A1 evidence. Its legacy IntentProposal/optional semanticRecipe is narrower than A1's bundle. Resume shared integration only after concrete interface agreement and the newest accepted canonical source are available. Preserve complete independent A1 candidate if Phase 3 is still unmerged. No source import, paid canary, cloud tests or authority reuse is implied.

Checks currently DEFERRED: full authenticated Assistant browser journey, mobile/visual/motion package and final ordinary Sounding Line. Independent Admiralty quota/dossier browser journeys have passed, and draft PR #710 preserves the source-bound independent checkpoint; exact source and receipt identities are recorded in the A1 evaluation document. Deterministic local checks already run are not scheduled for duplicate cloud qualification. These earlier focused receipts alone do not qualify the integrated Assistant or its canonical Apply.

## Bilateral amendment acknowledgement, 2026-10-11

A1 ACCEPTS every item in Phase 3 `.agents/parallax-phase3.md` section "A1 interface decision: ACCEPT WITH AMENDMENTS; integration HELD", read directly from the sibling owned checkout. This supersedes the earlier proposed autosave-after-apply wording: prepareBase drains persistence and returns draft/revision/generation; asynchronous response checks all three; canonical atomic Apply acknowledgement precedes ONE already-saved history install; rejection preserves history; uncertain network results reuse the same application identity; edits/Undo/Redo clear preview and review even if bytes match; narrow IntentProposal remains separate. A1 owns only additive CREATE/CONTENT/BEHAVIOR/FALLBACK and proposal/quota/usage models. Phase 3 owns resolution/field/calibration models. Reconcile both Prisma schemas/migrations by exact additive sections, never whole-file imports.

The isolated panel's contract tests prove generation-based rejection and stable uncertain-save retry identity. They do not prove a mounted host adapter, server atomic Apply, integrated browser behavior, owner visuals, or accepted mainline compatibility. Pilot mainline advance `01d32824127d00628546ea4209d09fea57c335c1` was verified by native origin/main fetch/readback. Phase 3's later viewport/docking/compact command refinement requires new owner visual review; prior approval of `01de94c67ed82d0812db6f884389e0b0fc52d274` does not approve those refinements or A1 visuals. Integration remains HELD until the newest accepted canonical Phase 3 source exists.

## Refined workstation approval and canonical handoff

The Phase 3 owner's current task authority now records direct visual approval of
source `592217e3edb214bab76373dc64cbe4b954ba3703`, tree
`36cb8d072caa7c17519d6398bd994c26c4c4a05f`. This supersedes the Phase 3 visual
hold above. Preparation may use that approved source and the agreed interface.
The canonical handoff remains Phase 3 ordinary qualification and protected merge;
mounted A1 integration must reconcile the final protected Phase 3 tree. This
approval does not cover A1's unmounted panel, its future integrated visuals or
subsequent Phase 3 field/Device Lab changes. The sibling checkout remains untouched.

## Prepared canonical adapter

`src/components/studio/parallax/spatial-assistant-port.ts` prepares the agreed
port against that approved source. The host provides current account/draft scope,
CSRF, `readBase`, serialized `prepareBase`, and synchronous `installSaved(saved,
expectedBase)`. Mount one stable adapter per account/draft. InstallSaved must
recheck local generation, make ONE ordinary history replacement, update the
revision/saved JSON and refs, and return without enqueuing a duplicate autosave.
The helper validates exact response binding and saved materialization before
calling that seam; it never invokes ordinary SAVE or owns history.

Prepared HTTP bodies use the existing `/api/studio/parallax`: `action: AI,
kind: ASSISTANT` plus the bounded request fields, and non-paid
`action: ASSISTANT_APPLY` plus retained proposal/selected IDs/idempotency. These
handlers are now installed in the existing authenticated/CSRF/rate-limited
route with request cancellation, atomic canonical save/receipt logic, and a
retired legacy network path. The current action names do not authorize a competing
inference endpoint. Fourteen adapter tests are narrow mocked transport/host
proof, not mounted or backend qualification.

Native handoff verification now clears the protected-source prerequisite:
PR #711 is merged as `0327eeb7bbe74a5fd7e7dba30dc64aaf22953dd6`, fetched
main tree `36529aefcac815a8a1cef0434624149b9b567e6f`; normal run
`38171123906`, job `114563773604` completed successfully. This authorizes the
original exact additive A1 reconciliation in its owned checkout. Phase 3 visual
approval remains bound to its reviewed workstation source; A1 must still qualify
its own resulting integration, saved Apply, browser journeys and visuals.

## Mounted integration checkpoint

The candidate reconciled accepted main in commit `a4d469bb`. The port is now
created outside render and scoped to account/definition. All canonical mutations,
installs, Undo and Redo advance a monotonic local generation; refs are updated
synchronously. Apply uses the same serialized persistence queue, installs one
ordinary history entry after the exact save acknowledgement, and marks it already
saved. Canonical save and metadata-only retry receipt commit in one transaction.
Authorization is resolved before that transaction and bound to its checksum;
transactional calibration checks use the transaction client. No second inference
or save endpoint exists, and legacy network requests are retired.

Assistant and guided-composer previews have separate host state. Selecting or
locating a newly proposed object retains its actual verified canvas preview.
Canonical mutations, draft switches, close and Escape clear it. Preview rechecks
local generation after async materialization. This source/DOM proof does not
establish WebGL pixels, mobile layout, motion captures or owner visual acceptance.
The complete authenticated browser journey, final ordinary qualification and
explicit paid canary gates remain pending.
