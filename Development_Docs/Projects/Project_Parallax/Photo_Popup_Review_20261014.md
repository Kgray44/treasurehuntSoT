---
title: Photo setup presentation and persistent outcome review
audience: product-engineering
status: bounded-owner-presentation-accepted
canonical_for: parallax-photo-popup-review-20261014
last_reviewed: 2026-10-14
---

# Requested correction

The owner rejected the photo setup's visual clutter and reported that processing
stopped after roughly twenty seconds without a visible result. A read-only audit
of the latest owner-preview reconstruction found a settled FAILED result after
32.464 seconds. The request reached a terminal result; the old form placed its
feedback below a long upload and permission area, making it easy to miss.
The policy timeout was already 90 seconds. This correction does not conceal
failure by changing the timeout or relaxing geometry validation.

The modal now has a clear title and Photos / Build / Review progression. Setup
centers on a compact photo chooser, one/two thumbnails, explicit OpenAI consent
and the primary action. Privacy and retained-photo withdrawal remain accessible
through disclosures. Processing replaces the form with an animated room outline,
the actual phase, elapsed-time feedback after twenty seconds and cancellation.
Reduced motion keeps static status information.

Timeout, connection failure, geometry clarification and cancellation render a
persistent card above the form. Focus and scrolling bring that card into view.
A plain-language outcome, detailed reason and immediate deliberate retry are
available; selected photos remain. No retry runs automatically. A separate effect
dependency defect is also corrected: a new parent preview callback no longer
aborts an active request. Definition changes and unmount still clean up requests.

# Source-bound evidence and acceptance

The [actual application gallery](../../Testing/Product_Experience/evidence/parallax-photo-popup-20261014/55f22c4fadcb/review.html)
contains nineteen images and six recordings, bound to source
`55f22c4fadcbb22458c79095438bf592ef473880`, tree
`2b9e205671cdbc8b41dbbaa4262e5373d82c5f6b`. Its immutable capture receipt records
VALID source binding and six passing isolated development journeys. The three
new adverse journeys cover desktop dark timeout after a real twenty-second wait,
phone light clarification, and desktop light connection failure. They verify
focused visible feedback, an immediately visible retry, no automatic reissue,
permission withdrawal and unchanged original scenes. The existing journeys
cover cancellation, one/two-photo 3D proposal navigation, saved independent rooms,
refinement and authored scene replay. Five component lifecycle/recovery tests
and nine route tests pass; type checking and focused lint also pass.

Earlier captures at 38cb7737 and 81c0a4a1 are retained in ignored task artifacts.
The d29500cc run retained five passes and a cancelled-request retry race: its
test reissued before canonical admission cleanup completed. The final test waits
for that observed server transition without changing concurrency policy. Failed
evidence is preserved rather than relabeled.

The owner directly replied **“Accept this popup presentation”** to the 55f22c4f
gallery review question on 2026-10-14. This is bounded owner presentation
acceptance for the popup. The immutable independent review at that source has
SHA256 `6876ca632d92cf9d3abc5f15fb5e0a63b38e77222de78f9db06a976c73c35304`
and disposition VERIFY_FINAL_EVIDENCE within its stated scope. A further six-pass
continuation at `f985bdb8ee0e28fd946498ec149559cd274e1b59` explicitly clicks retry
and withdraws two distinct photo grants without reopening the disclosure; its
independent review has SHA256
`76e2c7898cc053ba4b06e159235d65ab94fcb8e6ed4b7db1d4f1a8e4b0810e2b`.
Six component recovery/lifecycle checks pass at that continuation. The earlier
b254d222 fixture reused an identical photo and incorrectly expected two media
IDs; that failed evidence remains retained, and the fixture now uses distinct
camera views rather than changing canonical deduplication. Earlier owner
acceptance stays bound to the 55f presentation. Synthetic fixtures and injected HTTP faults establish UI recovery,
not live reconstruction quality, production scanner readiness or physical AR.

The ordinary full-candidate experience planner still reports
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity` for the
existing Crossdeck/Parallax integration design. This bounded development package
does not issue a protected mainline decision or replace that governing gate.

The separately requested fresh two-photo room check uses the supplied owner
images in private, isolated artifacts. Its outcome and cost are recorded
separately. Popup acceptance does not accept a room layout or finish the overhaul.
