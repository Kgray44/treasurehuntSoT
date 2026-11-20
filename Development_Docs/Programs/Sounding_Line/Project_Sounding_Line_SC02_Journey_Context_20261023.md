---
title: SC02 journey context representation draft
audience: engineering
status: inactive-local-draft
canonical_for: sounding-line-sc02-journey-context-20261023
last_reviewed: 2026-10-23
---

# SC02 journey context representation

This noninstalled maintenance draft is based on accepted source
b2d901af5646ce76b3b2bd5a88e1ad8563c2db57. It changes only the experience
runner representation and focused tests; the product owner retains the SC02
registry, product behavior and actual four-context development proof. Protected
installation, capture dispatch, merge and product acceptance remain outside this
record. The completed Core05 local-media intake lane remains frozen separately.

## Fixed representation

New fields opt in only for contract spatial-pilot.experience and journey
sc02-assets-and-reusable-composition, with DESKTOP/MOBILE and NORMAL/REDUCED:

- devices: one or two unique device enums, only on button clicks for Open object
  properties or the fixed Filters & view accessible-name forms. These navigation
  steps cannot carry outcome, state, feedback, return or name-substitution fields.
- contextValue: SC02_COMPOSITION_NAME, only on fills of textbox Object name or
  searchbox Search compositions, with no literal value. It resolves to
  SC02 synthetic composition DEVICE MOTION using the fixed enums.
- contextName: SC02_COMPOSITION_INSPECT_NAME, only on a button click whose literal
  name is Inspect SC02_COMPOSITION_NAME. It resolves to the full Inspect name.
  Assertions cannot use this token. Existing SC02 saved-state evidence asserts
  Add saved composition and retains its original outcome object.

There is no arbitrary interpolation, environment lookup or selector evaluation.
Explicit context fields resolve once before browser interaction; execution and
predicate lookahead consume the same entries, original step indices and
applicability decisions. Skipped navigation is excluded before lookahead barriers.
The stepContext ledger reports device, motion, applicability and substitutions.
Legacy journeys without these fields retain literal labels and ignored fields.
False-to-true action causality, no-op rejection, return paths, feedback boundaries,
timeouts, paired evidence and provenance requirements retain their existing logic.

## Focused evidence and limits

Final held source is Core03, manifest SHA-256
66e7470337a85036e05bccc8e4731bfad705cb627ca8dd54a3774d9e53f38e31.
Raw source, recipes, claims, streams and terminal results are retained in the owned
journey-context-20261023 evidence directory; Core01 and Core02 stay historical.

The current focused05 run passed 3/3 tests. It covers unrelated legacy literals,
all four device/motion mock contexts, no-op rejection, original indices, fixed
name/search resolution and 13 preinteraction malformed-input denials. The native
Chromium Source test uses the accepted keyboard action with m/Enter across four
viewport/motion contexts, including Favorites and Recently used after My creations.
It is synthetic control proof. It establishes no actual Studio journey outcome;
b/Enter remains source-supported but is not a measured built-in selection here.
No new select or focus action is added.

Current lint-final04 passed in 2,658 ms under the unchanged 60-second limit.
Original lint02 remains INCOMPLETE after its 60-second timeout and zero streams;
the diagnostic pass does not establish the cause. Original failed setup wrappers,
loader attempt and stale test-fixture failure remain retained independently.

The unchanged accepted central validator is included in source pins. No TypeScript
source changed and no whole-repository strict TypeScript or production build proof
is claimed. The owner must reconcile the exact registry, run its strict/collection
preflight and actual DESKTOP/MOBILE x NORMAL/REDUCED development journey, obtain
joint source review and complete normal protected qualification before integration.

## Documentation and feature decision

This file is engineering evidence; the linked automation packet is inactive task
context. Navigation and generated documentation inventories include this record.
The draft adds no completed major capability or product availability change, so
no feature fragment change is required. Product features, current status, feature
status, guides and changelog need no behavior update for this noninstalled draft.
