---
title: Complete Parallax integration preparation
audience: product-engineering
status: in-progress
canonical_for: parallax-complete-integration-preparation-20261019
last_reviewed: 2026-10-19
---

# Current-main rehearsal

This task owns `codex/parallax-integration-prep-20261019` in a separate managed
worktree. Its protected base is `f6af0b0e151f15f1a23808413ccee531b9827ca7`;
the combined #722 intake is `c293af18d56e7bf29c02a7667b23d9a3fe658646`.
Merge `5e3bf97f243b37ef8a3bfded919887b532d67079` preserves both histories.
The original #722 branch and all sibling worktrees remain independently owned.
This record is preparation, not protected qualification or physical acceptance.

## Source decisions

| PR   | Source disposition                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #722 | Combined product root; one additive merge into current main.                                                                                                                                                                                                                                                                                                                                   |
| #727 | Historical SC-01 head. Its adopted implementation `76da4c36` is a root ancestor. The canonical port now uses `scene-environment-authoring`, `legacy-environment-service`, explicit working/release bindings and `scene-comparison-compatibility.test.ts`. Replaying the old service would replace later lifecycle and animation comparison behavior. Preserve its distinct engineering record. |
| #728 | Exact head `73db990b` is a root ancestor. Original assets, provenance and typed element contracts are retained. No duplicate merge.                                                                                                                                                                                                                                                            |
| #729 | Historical Inspector runtime, superseded by the combined `6bea2130` implementation already in root ancestry. Preserve later numeric step/drag commit fixes and current Studio layout.                                                                                                                                                                                                          |
| #734 | Acceptance packet: all 141 unchanged introduced records match root; seven surrounding current documents have later root edits. No new product delta or missing packet file.                                                                                                                                                                                                                    |
| #733 | Historical Library implementation superseded by the current expanded Library and canonical Scene/Environment port. Do not restore retired navigation or tests.                                                                                                                                                                                                                                 |
| #736 | Publisher source matches root. Its older browser test is superseded by the richer current test. Retain distinct historical evidence from the current handoff.                                                                                                                                                                                                                                  |
| #739 | Both introduced product/test files already match root exactly. Later root Library/context-menu and test migrations take precedence. Intake only missing Parallax engineering evidence; exclude its inherited obsolete Crossdeck automation and authority.                                                                                                                                      |
| #725 | Independent Admiralty economics, 20 commits outside root, including accounting/schema and UI changes. Dependent on Studio; retain the post-Parallax owner lane. Existing Studio accounting remains governed and tested.                                                                                                                                                                        |
| #726 | Independent Chronicle Creator creation/details and acceptance scope. Existing Creator entry remains a consumer; no silent adoption of its pending feature or review entitlement.                                                                                                                                                                                                               |
| #741 | Independent native delivery/asset/runtime boundary. Preserve compatible current shared contracts and Guided alternatives; no native installation or physical AR claim.                                                                                                                                                                                                                         |

The [ancestry manifest](evidence/integration-preparation-20261019/ancestry-map.json)
records exact heads, merge bases, unique commit lists, shared paths and mainline
deltas. The [blob containment audit](evidence/integration-preparation-20261019/source-containment.json)
distinguishes equal, later-changed and missing paths; a non-ancestor PR head is
not evidence of missing implementation. The [record intake](evidence/integration-preparation-20261019/historical-record-intake.json)
binds 24 newly preserved historical documents/captures to their original blobs
and SHA-256 values. No historical PR is closed by this preparation.

## Conflict record

There are four actual merge conflicts, with no source/schema conflict:

- `.gitattributes`: preserve the union of mainline and Parallax evidence rules.
- `scripts/generate-document-index.mjs`: preserve current main's three 64 MiB
  buffers, superseding the older Parallax 16 MiB values.
- `Development_Docs/document-index.json` and the Ledgerlight migration CSV:
  regenerate from the reconciled source using the current generator.

Inherited raw evidence includes producer whitespace preserved by nested attribute
rules. Its original bytes are not reformatted. Source whitespace is checked
separately from these immutable archives; all original failing diagnostics remain.
The selected focused unit run exposed one stale saved-asset mock; the fixture now
provides the canonical saved source and target separately without relaxing any
existing assertion or product guard.

## Verification and acceptance boundary

Full TypeScript passes on the rehearsal. The first focused run passes 1,358 of
1,365 cases with zero pending. Six publication failures are attributable to the
launch omitting the required synthetic scanner isolation nonce; one failure is
the stale saved-source mock. A fresh isolated rerun of the two affected files
and scanner regressions passes all 28 cases. These are overlapping observations,
not an added whole-suite count. Production browser, integrated rendered review,
database/privacy/authorization closure and documentation/catalog checks remain
in progress and will be recorded against their actual tested source.

The exact experience planner fails closed with
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity:Crossdeck and Parallax experience integration`.
Intake #721 remains draft at `b55f5a32b7a6c42ba309db756f944e50145de123`.
Its R19 review still requires phone Journal prominence repair. Crossdeck's owner
retains its source, capture/review counters and protected qualification. This
task does not import unfinished Crossdeck product work or run final authority.

After accepted Crossdeck closure and landed verification, refresh protected main
once, reconcile material changes, freeze the final combined candidate, run the
complete affected Product Experience capture and independent authenticated review,
then ordinary Sounding Line, protected merge binding and landed smoke. Preserve
all contract obligations, scanner/licensing/privacy gates and original evidence.
Physical AR, live-photo confidence, device performance and owner product acceptance
remain separate evidence classes.
