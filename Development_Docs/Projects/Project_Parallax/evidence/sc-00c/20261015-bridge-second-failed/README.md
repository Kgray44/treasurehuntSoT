---
title: SC-00C bridge Library second browser attempt
audience: product-engineering
status: failed-local-attempt
canonical_for: sc-00c-bridge-library-second-failed-browser
last_reviewed: 2026-10-15
---

# Second bridge Library browser attempt

The authenticated synthetic browser run on `9babcc0fbdd0` built and loaded Spatial Studio, then stopped before Library actions. The corrected label query matched both **Current scene** and **Current scene time** because it omitted exact matching. The [run receipt](run.json), [page context](error-context.md), screenshot, video, trace and log retain that selector failure. The next test requests the exact Current scene label. This attempt is not Library behavior or qualification proof.
