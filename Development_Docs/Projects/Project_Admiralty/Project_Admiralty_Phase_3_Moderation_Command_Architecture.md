---
title: Project Admiralty Phase 3 Moderation Command Architecture
audience: engineering-security-quality
status: current
canonical_for: project-admiralty-phase-3-moderation-commands
last_reviewed: 2026-08-13
---

# Phase 3 moderation command architecture

Admiralty's `COMMUNITY_MODERATE` command port calls Harborlight's canonical
preview and action lifecycle. Harborlight retains case attachment, transition,
conflict, self-moderation, reviewer, idempotency, and restoration eligibility
rules. The Admiralty audit is inserted inside the Harborlight action transaction
so required audit failure cannot leave an unrecorded moderation mutation.
