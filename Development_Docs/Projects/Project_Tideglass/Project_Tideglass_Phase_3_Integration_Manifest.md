---
title: Project Tideglass Phase 3 Integration Manifest
audience: product-engineering
status: current-main-qualified-authority-pending
canonical_for: project-tideglass-phase-3-integration
last_reviewed: 2026-08-13
---

# Project Tideglass Phase 3 integration manifest

Status: `CURRENT_MAIN_QUALIFIED_AUTHORITY_PENDING`.
This is a source integration inventory, not an accepted-mainline or
protected-mainline receipt. The original owner decision and the explicit
Wakebook Journey Detail addendum acceptance are recorded; protected integration
remains required.

## Canonical consumer path

| Consumer                | Phase 3 integration                                                                                                      | Safety contract                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chronicle detail        | `src/app/chronicles/[taleSlug]/page.tsx` exposes **See what changed** to the canonical compare page                      | The user can reach comparison without guessing a URL.                                                                                                                          |
| Passage page            | `src/app/chronicles/[taleSlug]/compare/page.tsx` renders `TideglassPassage`                                              | Query state selects only exact edition IDs and an owner-bound record; it cannot grant authority.                                                                               |
| Passage API             | `src/app/api/tideglass/chronicles/[taleSlug]/route.ts` reads `loadTideglassPassageContext` and `compareTideglassPassage` | The server derives edition visibility, current pointer, history ownership, and audience. No raw snapshot, private location, media, Creator notes, or storage key is projected. |
| Passport history        | `src/app/passport/history/[recordId]/compare/page.tsx` resolves the signed-in owner record then redirects                | Client input never supplies a trusted Chronicle identity. Foreign records fail closed.                                                                                         |
| Wakebook Journey Detail | `src/wakebook/archive-query.ts` creates a Tideglass-owned safe handoff and `WakebookVoyageDetail` renders it             | The archive selects no edition and performs no comparison. It receives a link only after exact owner-record and publishing-target resolution.                                  |
| Creator Studio          | `src/components/studio/TaleEditor.tsx` renders `TideglassStudioComparison` using the Studio semantic comparison API      | Creator output is `CREATOR_FULL` Tideglass semantic change data, not a raw before/after storage comparison.                                                                    |

## Retired ordinary consumer

`src/chronicle/studio-service.ts` no longer calls or exposes the legacy `comparePublishedVersions` raw comparator for Studio product rendering. `TideglassStudioComparison` presents semantic change cards and explicit technical labels only. The implementation is statically checked by `tideglass:phase3:validate` and covered by the Studio component test.

## Non-goals and preserved owners

- Tideglass semantic comparison, projection, summary, annotation, publishing `isCurrent`, and Wayfarer history remain their existing accepted authorities.
- Phase 3 does not write editions, Voyage history, annotations, release state, publishing state, or schema migrations.
- Phase 4 integrations, background processing, and any broader historical corpus remain deferred.
- The Deepwater legacy-comparator finding is not closed by this branch until the governed qualification, owner acceptance, mainline decision, merge, and closure record all exist.

## Required closeout evidence

The candidate was reconciled to fetched `origin/main`, and the static consumer
audit and browser journey were rerun against the reviewed product source.
Canonical owner acceptance is recorded in
`Project_Tideglass_Phase_3_Owner_Decision_Record.md`. Before the manifest can
become a completion receipt, its post-repair exact documentation-qualified SHA
must receive the single replacement authoritative decision and protected
integration. The recorded preflight `ENOENT` produced no finalizer or suite
receipt. Hosted run `31634707413` then failed in environment-free registry
discovery before any worker receipt or finalizer. The Validation Record records
the exact failure, the deferred-runtime repair, fresh source-bound browser
proof, and the one permitted replacement authority attempt.

## Reconciled-main result

The branch now contains accepted `origin/main`
`fb0f13e35fcdd98434d22c357aee02f24d6d9036`. The prior
reconciled accepted Shipwright/Drydock Studio surface was retained while the Tideglass
semantic component stayed the only edition-comparison consumer. The accepted Helm surface has no edition-comparison
consumer, so `CAPTAIN_UI_DEFERRED_NO_ACCEPTED_CONSUMER` is retained. The Deepwater
finding remains open until this owner-accepted candidate receives the required
mainline decision and protected integration; it is not closed by local evidence.

The post-owner base advances consist of Admiralty's accepted closeout records,
Helm's accepted Phase 2 product/record changes, and the Sounding Line
record-only closure. The branch preserves exact Tideglass product equivalence to
owner-reviewed `c2fc8fcc`; the changed Helm browser family passed all 3/3
registered cases with clean runtime conformance, and record-only changes affect
only governed authority/binding behavior. No accepted-main change authorizes a
Wakebook, Helm, Shipwright, or Deepwater Phase 4 dependency.

## Accepted Wakebook reconciliation

Wakebook Phase 1 was accepted at `cbf634d4d5db9cf47edebb89e005e8cc910068bd`;
current `origin/main` is `770404dd11cdfc1b86658a488979c43c22ed1711` after
accepted Deepwater/Helm/Homeport work with no direct Tideglass or Wakebook
product-source overlap. Journey Detail is now the ordinary past Voyage surface.
Tideglass therefore supplies a narrow read-only adapter that
uses the signed-in owner profile, exact `PlayerChronicleRecord`, and the
Publishing-owned current pointer to produce a same-origin comparison link only
for `PAIR` or `UP_TO_DATE`. Wakebook renders that link and never receives a
checksum, a raw snapshot, annotations, semantic records, or authority inputs.

This is an isolated current-main reconciliation. Focused service, archive-query,
component, TypeScript, documentation, catalog, and A-K task-owned production
browser proof are complete for source `c298d5c0db5c0cd015323fd7f7ad073b3e64e82a`.
The generated visual evidence adds a direct Journey Detail entry frame and
retains the exact-record return, privacy, Creator, mobile, zoom, reduced-motion,
and Axe assertions. The owner explicitly accepted this addendum and the rebased
current-main qualification is green. Neither fact authorizes a protected
binding, merge, or a retry of either frozen PR.

## Terminal authority result

The one hosted Mainline Decision for the reconciled candidate, run
`31658984596`, ended `RELEASE_NO_GO` solely because
`scripts/features/feature-catalog.test.ts` retained the former FT-B009 program
expectation. The semantic Tideglass, Wakebook handoff, navigation, privacy, and
Studio consumer evidence did not fail. The focused 9/9 Feature Catalog repair
is recorded in the Validation and Qualification Records. This manifest remains
non-merging until the repaired source has been requalified, frozen, and granted
a later serial authority position.

The required Sounding Line infrastructure prerequisite is now accepted at
`d3ed7c4c`; the Tideglass branch reconciles that finalizer/workflow/test-only
advance and reruns its production A--K browser journey on `89fb1df6`. The
ordinary Tideglass product surface is unchanged. A fresh frozen candidate and a
later serial authority position remain required before protected integration.

Deepwater's accepted record-only closure at `582f32a3` changes only its own
governance records, documentation index, and generated catalog provenance.
Tideglass revalidated the affected documentation/catalog contracts and retains
the source-equivalent product/browser proof. It does not create a parallel
Tideglass closure path or authorize a Mainline Decision.

Admiralty's `95cff272` record-truth repair is also non-product with respect to
Tideglass. The candidate carries its generated Feature Catalog provenance and
revalidated documentation/contract evidence forward without changing any
Tideglass consumer or creating a second authority path.

Shipwright Phase 2 at `25a5ecc3` changes the accepted Studio interaction
surface. Its current `TaleEditor` retains `TideglassStudioComparison` as the
ordinary semantic published-version consumer. Direct consumer proof is green,
and the refreshed A--K Tideglass production browser journey passes on
`622ee2bc`, including the Studio semantic card. The Shipwright test-budget
finding is recorded for its owner and does not justify a second comparison
engine or a Tideglass UI rollback.

Wakebook's protected merge at `0cdaa802` then advanced only governed
documentation, catalog fragments/provenance, and the generated test registry.
The branch carries it as `836ef9d3`; it contains no Tideglass runtime, route,
schema, or Tideglass-test source overlap. The source-bound browser proof remains
applicable, and the current source passes Tideglass 109/109, direct history
handoff 24/24, Studio 2/2, contracts, Prisma generation/typecheck, lint with
zero errors, formatting, documentation, and Feature Catalog validation.

Shipwright's record-only Phase 2 closeout protected-merged at `9867e3d4`.
Its source interval is records, catalog/document provenance, and product-status
documentation only. The Tideglass product/browser source is unchanged and the
focused semantic/history/Studio suite is green 136/136, including all 18
`TaleEditor` cases. The sole pending item is a format failure in three
Shipwright-owned accepted-main closeout documents. This is an ownership handoff,
not a Tideglass semantic regression or authorization to alter Shipwright
records.

Shipwright repaired that exact formatting boundary at accepted main
`4e88ba54`. The Tideglass branch carries it as `d4d13ce3`; global formatting,
Tideglass contracts, documentation, and Feature Catalog validation are green.
No Tideglass product/browser source changed, so the source-bound browser proof
and current semantic/history/Studio qualification remain applicable to the
fresh authority candidate.
