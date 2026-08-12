---
title: Project Tideglass Phase 3 Integration Manifest
audience: product-engineering
status: implementation-active
canonical_for: project-tideglass-phase-3-integration
last_reviewed: 2026-08-12
---

# Project Tideglass Phase 3 integration manifest

Status: `IMPLEMENTATION_REOPENED_QUALIFICATION_IN_PROGRESS`. This is a source integration inventory, not an acceptance or protected-mainline receipt.

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

Before the manifest can become a completion receipt: the candidate must be reconciled to fetched `origin/main`, the static consumer audit and browser journey must be rerun against that candidate, and canonical owner acceptance must precede the single authoritative decision.
