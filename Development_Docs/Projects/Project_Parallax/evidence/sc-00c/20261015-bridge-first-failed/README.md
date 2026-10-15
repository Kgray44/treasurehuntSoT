---
title: SC-00C bridge Library first browser attempt
audience: product-engineering
status: failed-local-attempt
canonical_for: sc-00c-bridge-library-first-failed-browser
last_reviewed: 2026-10-15
---

# First bridge Library browser attempt

The authenticated synthetic browser run on `ad6fe6542318` built and loaded Spatial Studio, then stopped before exercising the Library. Its first assertion searched for the Scene title as a level-one heading. The rendered page instead correctly has **Parallax** as the level-one heading and labels the Scene in its **Current scene** region. The [run receipt](run.json), [page context](error-context.md), screenshot, video, trace and log retain that exact failure. The next test queries the existing Current scene label. This attempt is not Library behavior or qualification proof.
