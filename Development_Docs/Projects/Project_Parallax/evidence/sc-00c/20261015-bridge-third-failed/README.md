---
title: SC-00C bridge Library third browser attempt
audience: product-engineering
status: failed-local-attempt
canonical_for: sc-00c-bridge-library-third-failed-browser
last_reviewed: 2026-10-15
---

# Third bridge Library browser attempt

The authenticated synthetic browser run on `07e99dcf72eb` built and loaded Spatial Studio, then stopped before Library actions. Its Workspace layout label query also matched **Reset Workspace Layout** because it omitted exact matching. The [run receipt](run.json), [page context](error-context.md), screenshot, video, trace and log retain that selector failure. The next test selects the exact Workspace layout combobox. This attempt is not Library behavior or qualification proof.
