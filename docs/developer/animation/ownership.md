---
title: Animation ownership
audience: developer
status: current
canonical_for: animation-ownership
last_reviewed: 2026-07-27
---

# Animation ownership

The active scene host owns live animation lifecycle. Asset registries own identifiers and metadata; route components own placement; domain services own story state. Do not duplicate scene hosts across connected roots or use animation state as an authorization source.
