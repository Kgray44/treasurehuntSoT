---
title: Project Wakebook Phase 1 Evidence Index
audience: quality-engineering
status: current
canonical_for: project-wakebook-phase-1-visual-evidence
---

# Project Wakebook Phase 1 visual evidence

This directory holds the source-bound synthetic browser captures required for the private Journey Archive owner walkthrough.
The evidence is generated only by the existing Wakebook Playwright lane with `WAKEBOOK_PHASE1_CAPTURE_EVIDENCE=1`, then
checksum-verified and reviewed through `scripts/wakebook/finalize-phase1-visual-review.mjs`.

Do not edit images or manifest metadata independently. Regenerate the complete task-owned fixture, rerun the review,
and update the validation record whenever the exact implementation source changes. The evidence supports readiness only;
it is not owner acceptance, a deployed review, or protected-main authorization.
