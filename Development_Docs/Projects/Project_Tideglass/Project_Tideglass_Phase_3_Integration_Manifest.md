---
title: Project Tideglass Phase 3 Integration Manifest
audience: product-engineering
status: product-mainline-accepted-record-closure-pending
canonical_for: project-tideglass-phase-3-integration
last_reviewed: 2026-08-12
---

# Project Tideglass Phase 3 integration manifest

Status: `PRODUCT_MAINLINE_ACCEPTED_RECORD_CLOSURE_PENDING`. This is the source
integration inventory for the protected-main product receipt.

## Canonical consumer path

| Consumer         | Phase 3 integration                                                                                                      | Safety contract                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chronicle detail | `src/app/chronicles/[taleSlug]/page.tsx` exposes **See what changed** to the canonical compare page                      | The user can reach comparison without guessing a URL.                                                                                                                          |
| Passage page     | `src/app/chronicles/[taleSlug]/compare/page.tsx` renders `TideglassPassage`                                              | Query state selects only exact edition IDs and an owner-bound record; it cannot grant authority.                                                                               |
| Passage API      | `src/app/api/tideglass/chronicles/[taleSlug]/route.ts` reads `loadTideglassPassageContext` and `compareTideglassPassage` | The server derives edition visibility, current pointer, history ownership, and audience. No raw snapshot, private location, media, Creator notes, or storage key is projected. |
| Passport history | `src/app/passport/history/[recordId]/compare/page.tsx` resolves the signed-in owner record then redirects                | Client input never supplies a trusted Chronicle identity. Foreign records fail closed.                                                                                         |
| Creator Studio   | `src/components/studio/TaleEditor.tsx` renders `TideglassStudioComparison` using the Studio semantic comparison API      | Creator output is `CREATOR_FULL` Tideglass semantic change data, not a raw before/after storage comparison.                                                                    |

## Retired ordinary consumer

`src/chronicle/studio-service.ts` no longer calls or exposes the legacy `comparePublishedVersions` raw comparator for Studio product rendering. `TideglassStudioComparison` presents semantic change cards and explicit technical labels only. The implementation is statically checked by `tideglass:phase3:validate` and covered by the Studio component test.

## Non-goals and preserved owners

- Tideglass semantic comparison, projection, summary, annotation, publishing `isCurrent`, and Wayfarer history remain their existing accepted authorities.
- Phase 3 does not write editions, Voyage history, annotations, release state, publishing state, or schema migrations.
- Phase 4 integrations, background processing, and any broader historical corpus remain deferred.
- The Deepwater legacy-comparator finding is a Deepwater-owned historical audit
  record. This manifest supplies the exact consumer and mainline evidence to
  its active Phase 4 owner; Tideglass does not rewrite that audit or declare
  its finding state closed.

## Accepted closeout evidence

The candidate was reconciled to fetched `origin/main`, and the static consumer
audit and browser journey were rerun against the reviewed product source.
Canonical owner acceptance is recorded in
`Project_Tideglass_Phase_3_Owner_Decision_Record.md`. The replacement candidate
`6bbb25690f73265ea0f702c2abe112d759c2aedf` received the one hosted
authoritative decision in run `31647929505`, `RELEASE_GO` with 38 clean
receipts, then merged through PR #59. Exact integrated main
`bb7676a75581d8d415c3ff7712cc38bc8decb031` also received local `RELEASE_GO`
with 38 clean receipts and runtime-conformance records. The earlier preflight
and registry-discovery attempts remain historical failures before a finalizer,
as recorded in the Validation Record.

## Reconciled-main result

The accepted product now exists on `origin/main`
`bb7676a75581d8d415c3ff7712cc38bc8decb031`. The prior
reconciled accepted Shipwright/Drydock Studio surface was retained while the Tideglass
semantic component stayed the only edition-comparison consumer. Wakebook remains
unmerged and is not consumed. The accepted Helm surface has no edition-comparison
consumer, so `CAPTAIN_UI_DEFERRED_NO_ACCEPTED_CONSUMER` is retained. The Deepwater
finding remains owned by its immutable Phase 3 audit; this accepted product
evidence is ready for the active Deepwater Phase 4 governed disposition rather
than a Tideglass-side state rewrite.

The post-owner base advances consist of Admiralty's accepted closeout records,
Helm's accepted Phase 2 product/record changes, and the Sounding Line
record-only closure. The branch preserves exact Tideglass product equivalence to
owner-reviewed `c2fc8fcc`; the changed Helm browser family passed all 3/3
registered cases with clean runtime conformance, and record-only changes affect
only governed authority/binding behavior. No accepted-main change authorizes a
Wakebook, Helm, Shipwright, or Deepwater Phase 4 dependency.
