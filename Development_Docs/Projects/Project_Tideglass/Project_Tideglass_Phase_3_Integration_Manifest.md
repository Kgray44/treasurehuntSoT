---
title: Project Tideglass Phase 3 Integration Manifest
audience: product-engineering
status: owner-accepted-mainline-pending
canonical_for: project-tideglass-phase-3-integration
last_reviewed: 2026-08-12
---

# Project Tideglass Phase 3 integration manifest

Status: `OWNER_ACCEPTED_MAINLINE_PENDING`. This is a source integration
inventory, not an accepted-mainline or protected-mainline receipt.

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

The branch is rebased on `541e914f481883200569f8cc7ec5ec9428d7cbb7`. The prior
reconciled accepted Shipwright/Drydock Studio surface was retained while the Tideglass
semantic component stayed the only edition-comparison consumer. Wakebook remains
unmerged and is not consumed. The accepted Helm surface has no edition-comparison
consumer, so `CAPTAIN_UI_DEFERRED_NO_ACCEPTED_CONSUMER` is retained. The Deepwater
finding remains open until this owner-accepted candidate receives the required
mainline decision and protected integration; it is not closed by local evidence.

The post-owner base advance consists of Admiralty's accepted closeout records and
a Helm browser-test stabilization. The branch preserves exact Tideglass product
equivalence to owner-reviewed `c2fc8fcc`; the changed Helm browser family passed
all 3/3 registered cases with clean runtime conformance before candidate freeze.
No accepted-main change authorizes a Wakebook, Helm, Shipwright, or Deepwater
Phase 4 dependency.
