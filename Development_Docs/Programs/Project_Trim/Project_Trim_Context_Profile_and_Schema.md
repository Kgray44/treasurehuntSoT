---
title: Project Trim Context Profile and Schema
audience: engineering
status: current
canonical_for: project-trim-context-profile-schema
last_reviewed: 2026-08-14
---

# Project Trim context profile and schema

`agent-context-profiles.json` defines the seven Phase 1 profiles: `product-phase`, `bug-repair`, `documentation-only`, `infrastructure`, `security-sensitive`, `integration`, and `release-closure`. Each profile specifies emphasis, deferred material, soft pointer guidance, authority/closure expectations, expansion triggers, and conservative fallback.

The canonical generated packet is JSON and has a deliberately simple Markdown projection. Required fields include task/source identity, scope, execution profile, authority and accepted-status pointers, ownership, likely source/schema/verification slices, mainline delta, risks/debt/mapping gaps, completion contract, expansion policy, confidence, and generator integrity metadata. Profiles are startup heuristics, not reading restrictions.

The task-local ledger has packet identity, reads with blob/digest identity and repeat flag, classified expansions, and one usage record. It excludes secrets, credentials, private content, full prompts, and raw logs.
