---
title: Project Trim Context Profile and Packet Schema
audience: engineering
status: current
canonical_for: project-trim-context-profile-schema
last_reviewed: 2026-08-18
---

# Project Trim context profile and packet schema

`agent-context-profiles.json` defines the seven current profiles: `product-phase`, `bug-repair`, `documentation-only`, `infrastructure`, `security-sensitive`, `integration`, and `release-closure`. Each profile specifies emphasis, deferred material, soft pointer guidance, authority/closure expectations, expansion triggers, and conservative fallback. Its Phase 2 packet contract freezes the `EXACT`, `BOUNDED`, `COARSE`, and `UNKNOWN` confidence vocabulary plus `FRESH`, `PARTIALLY_STALE`, `STALE`, `CONFLICTED`, and `UNKNOWN` staleness states.

The canonical generated packet uses schema `2.0` at `scripts/agent-context/packet-v2.schema.json`. It includes task/source identity, scope, execution profile, source-bound authority and prior-plateau pointers, ownership, source, schema/data, verification, dependency, and mainline-delta slices, risks/debt/mapping gaps, completion contract, expansion policy, confidence, staleness, and generator integrity metadata. Each reusable slice has exact source identities and a deterministic content/source binding. The compact Markdown projection is derived from the same packet truth rather than being a JSON pretty-print. Profiles are startup heuristics, not reading restrictions.

Targeted regeneration accepts a previous packet and one or more stale slice names. It refreshes the selected slice contracts and integrity bindings while preserving unrelated fresh slice bindings. A generator/profile identity change, authority conflict, or unknown path remains visible and cannot be summarized into false trust.

The task-local ledger remains a Phase 1-compatible template with packet identity, reads, searches, classified expansions, and one usage record. Persistent read/search optimization and Accepted Phase Capsules remain Phase 3 scope. Packets and ledgers exclude secrets, credentials, private content, full prompts, and raw logs.
