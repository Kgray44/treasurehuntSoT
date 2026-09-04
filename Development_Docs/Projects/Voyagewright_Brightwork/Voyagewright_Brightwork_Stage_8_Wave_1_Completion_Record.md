---
title: Voyagewright Brightwork Stage 8 Wave 1 Completion Record
audience: engineering-evidence
status: complete
canonical_for: voyagewright-brightwork-stage-8-wave-1-completion
last_reviewed: 2026-09-03
---

# Voyagewright Brightwork — Stage 8 Wave 1 Completion Record

**Status:** `COMPLETE — AUTHORIZED WAVE 1 REPAIRS VERIFIED`
**Candidate product commit:** `f6ae18eb0f0aae745d8afd681b42c2639678e013`
**Scope:** Only the Wave 1 authority from the frozen Stage 7 ledger: BW-M-008, BW-M-020, BW-M-023, BW-M-024, BW-M-025, BW-M-038, and the minimum shared-state composition needed to resolve BW-M-004 on the direct operations surface.

## Finding disposition

| Finding                               | Disposition             | Bounded repair and verification                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BW-M-008                              | `REPAIRED_AND_VERIFIED` | Corrected the known Journal, Captain, and Drydock mojibake literals. Added `npm run brightwork:text-integrity`, which rejects common mojibake/replacement-character sequences in user-facing TypeScript source, with a Node regression test and the existing focused Player regression.                                                                                                                                                                        |
| BW-M-020                              | `REPAIRED_AND_VERIFIED` | Same-tab preference saves now update the runtime bridge before later system-preference revalidation can restore stale state. Studio Exchange derives its 3D preview from the effective `useMotionMode()` state, retaining the reduced-motion static-poster contract. Focused bridge, runtime, and Exchange tests cover the persistence and full/reduced outcomes; the synthetic signed-in preference flow rendered `data-motion-preference="full"` after save. |
| BW-M-023                              | `REPAIRED_AND_VERIFIED` | Public Chronicle return/history links now live in a named, wrapping navigation container with an explicit gap. Rendered desktop evidence shows two separated, focusable links; the source test covers the same navigation landmark.                                                                                                                                                                                                                            |
| BW-M-024                              | `REPAIRED_AND_VERIFIED` | Catalog and start-preview subtitle headings are omitted when the optional value is absent or whitespace-only. Focused tests cover null and whitespace fixtures without inventing replacement copy.                                                                                                                                                                                                                                                             |
| BW-M-025                              | `REPAIRED_AND_VERIFIED` | Outgoing route-transition layers are immediately `aria-hidden` and inert at render time while their visual exit motion is retained. The timed component regression asserts one active `main` and one active `h1`.                                                                                                                                                                                                                                              |
| BW-M-038                              | `REPAIRED_AND_VERIFIED` | Private Operations now distinguishes loading, ready, unauthorized, unavailable, error, and intentional zero-record states. Each optional array has explicit empty copy, and absent protected-media data is no longer rendered as fabricated zero counts.                                                                                                                                                                                                       |
| BW-M-004 (minimum direct composition) | `REPAIRED_AND_VERIFIED` | Introduced only the local `OperationalSection` state-composition primitive required by Private Operations. It supplies consistent section shape and truthful fallback/empty behavior without a broad cross-family redesign.                                                                                                                                                                                                                                    |

## Reference contracts preserved

- Journal shell and fallback remain structurally unchanged; this wave corrected text only.
- Captain visual material, Studio Publishing Review, Admiralty, account-menu behavior, and all other reference-quality contracts are outside this diff.
- Browser and operating-system reduced-motion authority, the Exchange static poster, and its genuine reduced-motion behavior remain intact.
- `BW-PEND-001` and `BW-PEND-002` were not repaired, redesigned, or reclassified.

## Verification evidence

- `npm run typecheck` passed.
- Focused Vitest coverage passed: 37 tests across Private Operations, route transitions, public Chronicle catalog/start, preference runtime/bridge, and Studio Exchange.
- `npm run brightwork:text-integrity` and `node --test tests/brightwork/text-integrity.test.mjs` passed.
- The focused Player Experience mojibake regression passed.
- Targeted ESLint passed for every changed TypeScript/JavaScript file.
- A task-owned synthetic Stage 6 production build and local browser runtime were prepared at port 3110 before the product commit. Rendered checks confirmed the public Chronicle start view has one `main`, its expected `h1`, and named Chronicle-preview navigation with separate links; screenshots were retained only in the task-owned synthetic audit root.
- The same synthetic signed-in preference flow persisted `FULL` motion to the document runtime. The full-motion Studio Exchange control path is covered by its focused component test; the fixture's Creator route was correctly capability-gated and was not treated as a product failure.

## Evidence boundary

Wave 0's audit fixture is deliberately frozen to source `a82473c40114280694fd292f1103ae914dcc7c6c`. After committing this Wave 1 product candidate, a fresh fixture preparation correctly failed closed with `BRIGHTWORK_PRODUCT_SOURCE_BASELINE_MOVED:a82473c40114280694fd292f1103ae914dcc7c6c`; no visual corpus was regenerated or represented as current for the changed product SHA. This record therefore distinguishes focused/product-candidate verification from Wave 0 corpus recertification, production deployment, live-provider proof, assistive-technology testing, and owner visual acceptance.

## Deferred work

No Wave 2, wider state-system redesign, pending decision, reference-contract rewrite, release, or unrelated repair was started by this wave.
