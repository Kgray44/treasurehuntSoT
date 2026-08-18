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

The task-local ledger is now a Phase 3 logbook with canonical `1.0` schema, source-bound read/search entries, classified expansions, and explicit reuse decisions. Accepted capsules use the same deterministic canonicalization and distinguish `ACCEPTED` protected-main identity from `PROVISIONAL` candidates. Project Trim Phase 3 startup discovers the retained Phase 2 capsule, while the read-only Phase 4 startup proof discovers the landed Phase 3 capsule; this is continuation evidence, not Phase 4 implementation. Packets and ledgers exclude secrets, credentials, private content, full prompts, and raw logs; Phase 4 persistent learning remains outside this contract.
